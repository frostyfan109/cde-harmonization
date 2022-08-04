import logging
import string
import re
import spacy
from copy import deepcopy
from abc import ABC, abstractmethod
from typing import List, Dict
from rake_nltk import Rake
from keyphrase_vectorizers import KeyphraseCountVectorizer
from keybert import KeyBERT

CDE = List[Dict]

class Categorizer(ABC):
    def __init__(self, fields, options={}):
        self.options = dict(
            field_name="categories",
            score_threshold=0,
            **options
        )
        self.fields = fields
        
        self.nlp = spacy.load("en_core_web_sm")

        self.logger = logging.getLogger(self.__class__.__name__)
    
    @abstractmethod
    def categorize_field(self, cde_row: Dict) -> List[str]:
        ...
    
    """ Text normalization of categories """
    def normalize(self, category: str) -> str:
        doc = self.nlp(category)
        lemma = [token.lemma_ for token in doc]
        return " ".join([word for word in lemma if self.nlp.vocab[word].is_stop == False and not word in string.punctuation])

    def categorize_cde(self, cde: CDE) -> CDE:
        self.logger.info(f"Categorizing CDE fields using {self.__class__.__name__} using fields {self.fields}")
        category_field_name = self.options["field_name"]
        rows = deepcopy(cde)
        for i, field in enumerate(rows):
            categories = list(set([
                self.normalize(category) for category in self.categorize_field(field)
            ]))
            field[category_field_name] = categories
            self.logger.debug(f"[{i + 1}/{len(rows)}] Categorized field under {categories}")
        return rows


class RakeKeywordCategorizer(Categorizer):
    def categorize_field(self, cde_row: Dict) -> List[str]:
        r = Rake()
        for field in self.fields:
            r.extract_keywords_from_text(cde_row[field])
        return r.get_ranked_phrases()

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
            for processed_doc in self.model.extract_keywords(docs=docs, vectorizer=self.vectorizer):
                keyphrases += [keyphrase for (keyphrase, score) in processed_doc if score >= minimum_score]
        except Exception as e:
            self.logger.error(f"Failed to process fields: {docs}")
        return keyphrases

class ConceptualAnalysisCategorizer(Categorizer):
    def categorize_field(self, cde_row: Dict) -> List[str]:
        return []