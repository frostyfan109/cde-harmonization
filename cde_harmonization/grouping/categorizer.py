""" Create categorical tags on each CDE to assist in similarity analysis """
import logging
import string
import re
import spacy
import time
import requests
import multiprocessing
from copy import deepcopy
from itertools import chain
from abc import ABC, abstractmethod
from typing import List, Dict
from rake_nltk import Rake
from keyphrase_vectorizers import KeyphraseCountVectorizer
from keybert import KeyBERT

CDE = List[Dict]

class Categorizer(ABC):
    NLP_MODEL = "en_core_web_sm"
    def __init__(self, fields: List[str], options={}):
        self.options = {
            # Column name that categories are stored under in the CDE
            "field_name": "categories",
            "score_threshold": 0,
            "workers": multiprocessing.cpu_count(),
            **options
        }
        self.fields = fields
        
        self.nlp = self.load_nlp()

        self.logger = logging.getLogger(self.__class__.__name__)
    
    @abstractmethod
    def categorize_field(self, cde_row: Dict) -> List[str]:
        ...

    @classmethod
    def load_nlp(cls):
        try:
            return spacy.load(cls.NLP_MODEL)
        except ModuleNotFoundError:
            spacy.cli.download(cls.NLP_MODEL)
            return spacy.load(cls.NLP_MODEL)

    
    """ Text normalization of categories """
    def normalize(self, category: str) -> str:
        doc = self.nlp(category)
        lemma = [token.lemma_ for token in doc]
        return " ".join([word for word in lemma if self.nlp.vocab[word].is_stop == False and not word in string.punctuation])

    def categorize_cde(self, cde: CDE) -> CDE:
        start_time = time.time_ns()
        num_workers = self.options["workers"]
        self.logger.info(f"Categorizing CDE fields using fields {self.fields} using {num_workers} workers")
        category_field_name = self.options["field_name"]
        rows = deepcopy(cde)
        pool = multiprocessing.Pool(processes=num_workers)
        results = pool.imap(self.categorize_field, rows)
        pool.close()
        i = 0
        while True:
            try:
                result = next(results)
                field = rows[i]
                categories = list(set([
                    self.normalize(category) for category in result
                ]))
                categories = [category for category in categories if category != ""]
                field[category_field_name] = categories
                if len(categories) == 0:
                    self.logger.error(f"[{i + 1}/{len(rows)}] No categories found for field")
                self.logger.debug(f"[{i + 1}/{len(rows)}] Categorized field under {categories}")
            except StopIteration:
                break
            except Exception as exc:
                self.logger.error(f"[{i + 1}/{len(rows)}] Failed to categorize field")
            finally:
                i += 1
        self.logger.debug(f"CDE categorization completed in {(time.time_ns() - start_time) / 1E9:.2f} seconds")
        return rows

""" Categorize fields using keyword extraction via RAKE """
class RakeKeywordCategorizer(Categorizer):
    def categorize_field(self, cde_row: Dict) -> List[str]:
        r = Rake()
        for field in self.fields:
            r.extract_keywords_from_text(cde_row[field])
        return r.get_ranked_phrases()

""" Categorize fields using keyword extraction via KeyBERT """
class KeyBERTCategorizer(Categorizer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.model = KeyBERT()
        self.vectorizer = KeyphraseCountVectorizer()
    def categorize_field(self, cde_row: Dict) -> List[str]:
        docs = [cde_row[field] for field in self.fields]
        minimum_score = self.options["score_threshold"]
        keyphrases = []
        try:
            keyphrases += [
                keyphrase for (keyphrase, score)
                in chain.from_iterable(
                    self.model.extract_keywords(docs=docs, vectorizer=self.vectorizer)
                )
                if score >= minimum_score
            ]
        except Exception as e:
            self.logger.error(f"Failed to process fields: {docs}")
        return keyphrases

""" Categorize fields using NER via Monarch SciGraph annotator """
class SciGraphAnnotationCategorizer(Categorizer):
    SCIGRAPH_ANNOTATION_URL = "https://api.monarchinitiative.org/api/nlp/annotate/entities"
    def categorize_field(self, cde_row: Dict) -> List[str]:
        doc = ". ".join([cde_row[field] for field in self.fields])
        res = requests.post(self.SCIGRAPH_ANNOTATION_URL, {
            "content": doc,
            "min_length": 0,
            "include_abbreviation": False,
            "include_acronym": False,
            "include_numbers": False
        })
        data = res.json()["spans"]
        ner_annotations = []
        for ner_token in data:
            tokens = ner_token["token"]
            for token in tokens:
                curie = token["id"]
                ner_annotations.append(curie)
        return ner_annotations