""" Semantically analyze the similarity of CDE questions based on their categorical groupings """
import logging
import os
import itertools
import tensorflow as tf
import tensorflow_hub as tfhub
import numpy as np
import networkx as nx
from scipy.spatial import distance
from abc import ABC, abstractmethod
from typing import List, Dict, Tuple, Optional, NamedTuple

# Make sure TF-Hub caches to the trained_models directory so that weird tempfile stuff doesn't happen.
CACHE_DIR = os.path.join(os.path.dirname(__file__), "../", "trained_models")
if not os.path.exists(CACHE_DIR): os.makedirs(CACHE_DIR)
os.environ["TFHUB_CACHE_DIR"] = CACHE_DIR

CDE = List[Dict]

class Grouping(NamedTuple):
    categories: List[str]
    fields: List[Dict]

class SemanticAnalyzer(ABC):
    def __init__(self, fields: List[str], options={}):
        self.options = {
            # Column name that categories are stored under in the CDE
            "field_name": "categories",
            # "intersection" | "equivalence"
            # - "equivalence" requires fields to have identical sets of categories
            # - "intersection" simply requires the sets of categories to intersect
            # "equivalence" will run in significantly less time than "intersection"
            "grouping_method": "intersection",
            # Minimum score of similarity (scoring mechanism varies by implementation)
            "min_score": 0.5,
            **options
        }
        self.fields = fields

        self.logger = logging.getLogger(self.__class__.__name__)

    @abstractmethod
    def semantic_similarity(self, sentence1: str, sentence2: str) -> float:
        """ Returns a float between 0 and 1 indicating the semantic similarity of the two CDE questions. """

    @staticmethod
    def regroup_pairings(pairings: List[Tuple[Dict, Dict]]) -> List[List[Dict]]:
        """
        Need to take pairings of similary CDEs and group them with other pairings that share elements in common.
        If f1 and f2 are semantically similar, and so are f2 and f3, then f1 and f3 are also transitively similar.
        """
        G = nx.Graph()
        for (field1, field2) in pairings:
            # Ideally there'd be a column to uniquely identify a field, but this does not exist yet. 
            f1_id = f"{field1['variable_name']}-{field1['description']}-{field1['label']}-{field1['value_constraints']}"
            f2_id = f"{field2['variable_name']}-{field2['description']}-{field2['label']}-{field2['value_constraints']}"
            G.add_node(
                f1_id,
                data=field1
            )
            G.add_node(
                f2_id,
                data=field2
            )
            G.add_edge(f1_id, f2_id)
        regrouped = [[G.nodes[node]["data"] for node in node_group] for node_group in nx.connected_components(G)]
        return regrouped

    def find_grouping(self, categories: List[str], groupings: List[Grouping]) -> Optional[Grouping]:
        grouping_method = self.options["grouping_method"]
        for grouping in groupings:
            if grouping_method == "equivalence":
                if sorted(grouping.categories) == sorted(categories):
                    return grouping
            elif grouping_method == "intersection":
                if len(list(set(grouping.categories) & set(categories))) > 0:
                    return grouping
            else:
                raise Exception(f"Unrecognized grouping method '{grouping_method}'")

    def find_groupings(self, cde: CDE) -> List[Grouping]:
        category_field_name = self.options["field_name"]
        grouping_method = self.options["grouping_method"]
        self.logger.info(f"Finding CDE groupings using method '{grouping_method}'")
        groupings = []
        for i, field in enumerate(cde):
            categories = field[category_field_name]
            if len(categories) == 1 and categories[0] == "":
                continue
            
            if grouping_method == "equivalence":
                # If equivalence, maintain `categories` as the single category grouping
                categories = [[categories]]
            elif grouping_method == "intersection":
                # If intersection, split `categories` into single-category groups
                categories = [[category] for category in categories]

            for category_group in categories:
                grouping = self.find_grouping(category_group, groupings)
                if grouping is None:
                    grouping = Grouping(category_group, [])
                    groupings.append(grouping)
                    self.logger.debug(f"Creating new grouping")
                self.logger.debug(f"[{i + 1}/{len(cde)}] Adding field to grouping")
                grouping.fields.append(field)
            # found_groupings = self.find_grouping(categories, groupings)
            # if len(found_groupings) == 0:
            #     grouping = Grouping(categories, [])
            #     groupings.append(grouping)
            #     self.logger.debug(f"Creating new grouping")
            # self.logger.debug(f"[{i + 1}/{len(cde)}] Adding field to grouping")
            # grouping.fields.append(field)
        groupings = [grouping for grouping in groupings if len(grouping.fields) > 1]
        self.logger.debug(f"Average fields per grouping: {sum([len(grouping.fields) for grouping in groupings]) / len(groupings)}")
        return groupings

    def analyze_cde(self, cde: CDE) -> List[Dict]:
        min_score = self.options["min_score"]
        fields_of_interest = []
        groupings = self.find_groupings(cde)
        self.logger.info(f"Running analysis on {len(groupings)} groupings")
        grouping_combinations_list = [list(itertools.combinations(g.fields, 2)) for g in groupings]
        total_iterations = sum([len(c_list) for c_list in grouping_combinations_list])
        iteration = 0
        for i, grouping_combinations in enumerate(grouping_combinations_list):
            self.logger.debug(f"[{i + 1}/{len(grouping_combinations_list)}] Beginning analysis on grouping")
            for (field1, field2) in grouping_combinations:
                s1_data = [ field1[field] for field in self.fields if field1[field] != "" ]
                s2_data = [ field2[field] for field in self.fields if field2[field] != "" ]
                s1 = ". ".join(s1_data)
                s2 = ". ".join(s2_data)
                if (
                    field1["source_directory"] == field2["source_directory"] or
                    # This can occur when categorizations are generated on more columns than analysis is performed on
                    len(s1_data) == 0 or len(s2_data) == 0
                ):
                    self.logger.debug(
                        f"({i + 1}/{len(groupings)}) " \
                        f"[{iteration + 1}/{total_iterations}] " \
                        "Skipping pairing from same data dictionary"
                    )
                    iteration += 1
                    continue
                similarity = self.semantic_similarity(s1, s2)
                self.logger.debug(
                    f"({i + 1}/{len(groupings)}) " \
                    f"[{iteration + 1}/{total_iterations}] " \
                    f"Scored CDE {field1['variable_name']} {field2['variable_name']} {similarity}{ ' (discarded)' if similarity < min_score else '' }"
                )
                if similarity >= min_score:
                    fields_of_interest.append((field1, field2))
                iteration += 1
        return self.regroup_pairings(fields_of_interest)

class USE4Analyzer(SemanticAnalyzer):
    MODEL_PATH = os.path.join(os.path.dirname(__file__), "../", "trained_models", "universal-sentence-encoder_4")
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.model = tfhub.load("https://tfhub.dev/google/universal-sentence-encoder/4")
        # try:
        #     self.model = tf.keras.models.load_model(self.MODEL_PATH)
        # except:
        #     self.logger.debug(f"USE4 model not available locally (should be saved under {self.MODEL_PATH}), downloading from Tensorflow Hub...")
        #     self.model = tfhub.KerasLayer("https://tfhub.dev/google/universal-sentence-encoder/4")
    
    """ Returns the cosine similarity of the sentence encodings """
    def semantic_similarity(self, s1: str, s2: str) -> float:
        # Note that something like this could certainly be optimized such that embeddings are generated on all fields simultaneosuly,
        # but it has been done in this way for compatibility with future models where this may not be feasible.
        embeddings = self.model([
            s1,
            s2
        ])
        return 1 - distance.cosine(*embeddings)