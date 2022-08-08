""" Semantically analyze the similarity of CDE questions based on their categorical groupings """
import logging
from abc import ABC, abstractmethod
from typing import List, Dict, Optional, NamedTuple

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
            "grouping_method": "equivalence",
            **options
        }
        self.fields = fields

        self.logger = logging.getLogger(self.__class__.__name__)

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
        for field in cde:
            categories = field[category_field_name]
            grouping = self.find_grouping(categories, groupings)
            if grouping is None:
                grouping = Grouping(categories, [])
                groupings.append(grouping)
                self.logger.debug(f"Creating new grouping")
            self.logger.debug(f"Adding field to grouping")
            grouping.fields.append(field)
        groupings = [grouping for grouping in groupings if len(grouping.fields) > 1]
        self.logger.debug(f"Average fields per grouping: {sum([len(grouping.fields) for grouping in groupings]) / len(groupings)}")
        return groupings

    def analyze_cde(self, cde: CDE):
        groupings = self.find_groupings(cde)
        self.logger.info(f"Running analysis on {len(groupings)} groupings")
        