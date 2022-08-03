import logging
from copy import deepcopy
from abc import ABC, abstractmethod
from typing import List, Dict

logger = logging.getLogger(__name__)

CDE = List[Dict]

class Categorizer(ABC):
    def __init__(self, options={}):
        self.options = dict(
            field_name="categories",
            **options
        )
    
    @abstractmethod
    def categorize_field(self, cde_row: Dict) -> List[str]:
        ...
    
    def categorize_cde(self, cde: CDE) -> CDE:
        logger.info(f"Categorizing CDE fields using {self.__class__.__name__}")
        category_field_name = self.options["field_name"]
        rows = deepcopy(cde)
        for i, field in enumerate(rows):
            categories = self.categorize_field(field)
            field[category_field_name] = categories
            logger.debug(f"[{i + 1}/{len(rows)}] Categorized field under {categories}")
        return rows

class ConceptualAnalysisCategorizer(Categorizer):
    def categorize_field(self, cde_row: Dict) -> List[str]:
        return []