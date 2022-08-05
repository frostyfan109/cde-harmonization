import logging
import networkx as nx
from pyvis.network import Network
from typing import List, Dict

CDE = List[Dict]

logger = logging.getLogger(__name__)

category_name = "categories"

def visualize_cde(cde: CDE, export_gexf: str=None) -> None:
    G = nx.DiGraph()
    for cde_row in cde[:50]:
        field_name = f"{cde_row.get('variable_name')}:{cde_row.get('survey_version', 0)}"
        categories = cde_row[category_name]
        for category in categories:
            G.add_node(category, type="category")
            G.add_node(field_name, type="field")
            G.add_edge(category, field_name)

    category_nodes = [n for n in G.nodes(data=True) if n[1]["type"] == "category"]
    field_nodes = [n for n in G.nodes(data=True) if n[1]["type"] == "field"]
    sorted_categories = sorted([
        (category, len(G[category])) for (category, attr) in category_nodes
    ], reverse=True, key=lambda x: x[1])
    # for (category, count) in sorted_categories[:40] + sorted_categories[52:]:
    #     G.remove_node(category)
    # for node in [node for node, in_degree in G.in_degree() if in_degree == 0 and G.nodes[node]["type"] != "category"]:
    #     G.remove_node(node)
    
    category_nodes = [n for n in G.nodes(data=True) if n[1]["type"] == "category"]
    field_nodes = [n for n in G.nodes(data=True) if n[1]["type"] == "field"]

    print(f"""
Nodes: {len(G.nodes)} ({len(category_nodes)} categories, {len(field_nodes)} fields)
Edges: {len(G.edges)} \
""")

    net = Network(notebook=True)
    net.from_nx(G)
    net.show("CDE.html")
    

    if export_gexf is not None:
        nx.write_gexf(G, export_gexf)