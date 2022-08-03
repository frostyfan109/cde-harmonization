import logging
import string
import re
from copy import deepcopy
from abc import ABC, abstractmethod
from typing import List, Dict
from rake_nltk import Rake
from keyphrase_vectorizers import KeyphraseCountVectorizer
from keybert import KeyBERT

logger = logging.getLogger(__name__)

CDE = List[Dict]

class Categorizer(ABC):
    def __init__(self, fields, options={}):
        self.options = dict(
            field_name="categories",
            **options
        )
        self.fields = fields
    
    @abstractmethod
    def categorize_field(self, cde_row: Dict) -> List[str]:
        ...
    
    def normalize(self, category: str) -> str:
        # Remove punctuation
        category = category.translate(str.maketrans("", "", string.punctuation))
        # Remove double spaces
        category = re.sub(" +", " ", category)
        # Strip string
        category = category.strip()
        return category
        
    def categorize_cde(self, cde: CDE) -> CDE:
        logger.info(f"Categorizing CDE fields using {self.__class__.__name__} using fields {self.fields}")
        category_field_name = self.options["field_name"]
        rows = deepcopy(cde)
        for i, field in enumerate(rows):
            categories = [self.normalize(category) for category in self.categorize_field(field)]
            field[category_field_name] = categories
            logger.debug(f"[{i + 1}/{len(rows)}] Categorized field under {categories}")
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
        try:
            return [keyphrase for (keyphrase, score) in self.model.extract_keywords(docs=docs, vectorizer=self.vectorizer)]
        except: return []

class ConceptualAnalysisCategorizer(Categorizer):
    def categorize_field(self, cde_row: Dict) -> List[str]:
        return []