import networkx as nx
from typing import List, Dict

CDE = List[Dict]

category_name = "categories"

def visualize_cde(cde: CDE) -> None:
    G = nx.Graph()

    for cde_row in cde:
        categories = cde_row[category_name]
        print(categories)