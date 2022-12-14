import logging
import csv
from typing import List, Dict

logger = logging.getLogger(__name__)

CDE = List[Dict]

default_csv_options = {
    # Configures the delimiter used between CSV columns 
    "csv_delimiter": ",",
    # Configures delimiter used for the serialization of lists for CSVs
    # Format is "key_a{char_0}key_b{char_0}key_c"
    "csv_list_delimiter": ",",
    # Configures delimiter used for between keys and values in the serialization of dicts for CSVs
    # Format is "key_a{char_0}value_a{char_1}key_b{char_0}value_b"
    "csv_dict_delimiters": ",;",
    # Configures fields that should be parsed as lists in CSVs
    "csv_parse_lists": [],
    # Configures fields that should be parsed as dicts in CSVs
    "csv_parse_dicts": []
}

class CDELoader:
    def __init__(self, options={}):
        self.options = {
            **default_csv_options,
            **options
        }
    
    def load(self, fp: str) -> CDE:
        logger.debug(f"Attempting to load CDE file from '{fp}'")
        extension = fp.split(".")[-1]
        if extension == "csv":
            return self.load_csv(fp)
        raise Exception(f"Failed to load CDE: unsupported file name/extension '{fp}'")
    def load_csv(self, fp: str) -> CDE:
        logger.info(f"Loading CDE '{fp}' as CSV file")
        delimiter = self.options["csv_delimiter"]
        list_delimiter = self.options["csv_list_delimiter"]
        inner_dict_delimiter, outer_dict_delimiter = self.options["csv_dict_delimiters"]
        list_fields = self.options["csv_parse_lists"]
        dict_fields = self.options["csv_parse_dicts"]
        cde = []
        with open(fp, "r") as f:
            reader = csv.DictReader(f, delimiter=delimiter)
            for row in reader:
                for field in row:
                    if field in list_fields:
                        row[field] = row[field].split(list_delimiter)
                    if field in dict_fields:
                        row[field] = dict(
                            [inner_pair.split(inner_dict_delimiter) for inner_pair in row[field].split(outer_dict_delimiter)]
                        )
                cde.append(row)
        return cde
    
    def save(self, cde: CDE, fp: str) -> None:
        logger.debug(f"Saving CDEs file under {fp}")
        extension = fp.split(".")[-1]
        if extension == "csv":
            return self.save_csv(cde, fp)
        raise Exception(f"Failed to save CDE: unsupported file name/extension '{fp}'")
    def save_csv(self, cde: CDE, fp: str) -> None:
        delimiter = self.options["csv_delimiter"]
        list_delimiter = self.options["csv_list_delimiter"]
        inner_dict_delimiter, outer_dict_delimiter = self.options["csv_dict_delimiters"]
        # Preprocess cde for CSV serialization
        for row in cde:
            for col in row:
                if isinstance(row[col], list):
                    row[col] = list_delimiter.join(row[col])
                elif isinstance(row[col], dict):
                    row[col] = outer_dict_delimiter.join([
                        f"{key}{inner_dict_delimiter}{row[col][key]}" for key in row[col]
                    ])
        with open(fp, "w+") as f:
            writer = csv.DictWriter(f, fieldnames=cde[0].keys(), delimiter=delimiter)
            writer.writeheader()
            writer.writerows(cde)
