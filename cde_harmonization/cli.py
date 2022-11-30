import argparse
import logging
import os
import networkx as nx
from .utils import CDELoader

def categorize(args):
    from .grouping.categorizer import SciGraphAnnotationCategorizer, RakeKeywordCategorizer, KeyBERTCategorizer

    cde_file = args.cde_file
    output_path = args.output_path
    fields = list(set(args.field)) if args.field is not None else ["description"]
    categorizer_name = args.categorizer
    score_threshold = args.score_threshold
    workers = args.workers
    verbose = args.verbose
    quiet = args.quiet

    log_level = logging.ERROR if quiet else (
        logging.DEBUG if verbose else logging.INFO
    )
    logging.basicConfig(
        level=log_level,
        format="%(name)s - %(levelname)s - %(message)s",
        datefmt="%H:%M:%S"
    )

    cde_loader = CDELoader()
    cde = cde_loader.load(cde_file)

    categorizer = None
    options = {
        "score_threshold": score_threshold,
        **({"workers": workers} if workers is not None else {})
    }
    if categorizer_name == "scigraph":
        categorizer = SciGraphAnnotationCategorizer(fields, options)
    elif categorizer_name == "rake":
        categorizer = RakeKeywordCategorizer(fields, options)
    elif categorizer_name == "keybert":
        categorizer = KeyBERTCategorizer(fields, options)
    
    grouped_cde = categorizer.categorize_cde(cde)
    cde_loader.save(grouped_cde, output_path)

def analyze(args):
    from .grouping.semantic_analyzer import USE4Analyzer

    cde_file = args.cde_file
    output_path = args.output_path
    output_gexf = args.output_gexf
    fields = list(set(args.field)) if args.field is not None else ["description"]
    grouping_method = args.grouping_method
    similarity_threshold = args.similarity_threshold
    analyzer_name = args.analyzer
    id_field = args.id_field
    workers = args.workers
    verbose = args.verbose
    quiet = args.quiet

    log_level = logging.ERROR if quiet else (
        logging.DEBUG if verbose else logging.INFO
    )
    logging.basicConfig(
        level=log_level,
        format="%(name)s - %(levelname)s - %(message)s",
        datefmt="%H:%M:%S"
    )

    cde_loader = CDELoader({
        "csv_parse_lists": ["categories"]
    })
    cde = cde_loader.load(cde_file)

    options = {
        "min_score": similarity_threshold,
        "grouping_method": grouping_method,
        "id": id_field,
        **({"workers": workers} if workers is not None else {})
    }
    if analyzer_name == "use4":
        analyzer = USE4Analyzer(fields, options)

    (highly_related_fields, pairing_network) = analyzer.analyze_cde__MP(cde)
    # Flatten groups
    ungrouped_related_fields = []
    with open(output_path, "w+") as f:
        for i, group in enumerate(highly_related_fields):
            for field in group:
                field["related_group"] = f"group{i}"
            ungrouped_related_fields += group
        cde_loader.save(ungrouped_related_fields, output_path)
    if output_gexf:
        nx.write_gexf(
            pairing_network,
            # Output under the same path/name, but different extension (gexf)
            os.path.splitext(output_path)[0] + ".gexf"
        )

def make_categorize_parser(parser):
    parser.set_defaults(func=categorize)
    parser.add_argument(
        "cde_file",
        type=str,
        help="File path to CDE file that to perform field grouping on"
    )
    parser.add_argument(
        "output_path",
        type=str,
        help="File path to output the categorized CDE under"
    )
    parser.add_argument(
        "-c",
        "--categorizer",
        type=str,
        required=True,
        choices=["scigraph", "rake", "keybert"],
        help="Categorization algorithm to employ in the grouping of CDE fields"
    )
    parser.add_argument(
        "-f",
        "--field",
        default=None,
        action="append",
        help="Only these specified columns will be used by the categorization algorithm"
    )
    parser.add_argument(
        "-s",
        "--score_threshold",
        default=0,
        type=float,
        help="Minimum score of a category (varies by categorizer) required for a field to be marked with the category"
    )
    parser.add_argument(
        "-w",
        "--workers",
        default=None,
        type=int,
        help="Number of worker processes to use. Uses the maximum available if unspecified."
    )
    logging_group = parser.add_mutually_exclusive_group()
    logging_group.add_argument(
        "-v",
        "--verbose",
        default=False,
        action="store_true",
        help="Run in verbose mode. Verbose output of debugging information"
    )
    logging_group.add_argument(
        "-q",
        "--quiet",
        default=False,
        action="store_true",
        help="Run in quiet mode. Only output errors."
    )
    return parser

def make_analyzer_parser(parser):
    parser.set_defaults(func=analyze)
    parser.add_argument(
        "cde_file",
        type=str,
        help="File path to CDE file that to perform field grouping on"
    )
    parser.add_argument(
        "output_path",
        type=str,
        help="File path to output the categorized CDE under"
    )
    parser.add_argument(
        "-G",
        "--output_gexf",
        action="store_true",
        default=False,
        help="Output pairings as an undirected network in Graph Exchange Format (gexf)."
    )
    parser.add_argument(
        "-a",
        "--analyzer",
        type=str,
        required=True,
        choices=["use4"],
        help="Semantic analysis algorithm to employ in the analysis of categorical groupings"
    )
    parser.add_argument(
        "-g",
        "--grouping_method",
        type=str,
        required=True,
        choices=["equivalence", "intersection"],
        help="Method of clustering categorized cdes for analysis." \
            " Equivalence requires groups to share identical sets of categories," \
            " while intersection only requires groups to have intersecting sets of categories"
    )
    parser.add_argument(
        "-f",
        "--field",
        default=None,
        action="append",
        help="Only these specified columns will be used for semantic analysis"
    )
    parser.add_argument(
        "-i",
        "--id_field",
        default="Digest (variable_name|source_file|source_directory)",
        action="store",
        help="Column name that uniquely identifies a row (CDE) within the digest"
    )
    parser.add_argument(
        "-s",
        "--similarity_threshold",
        default=0.5,
        type=float,
        help="Minimum semantic similarity of two CDE questions to be deemed significantly similar"
    )
    parser.add_argument(
        "-w",
        "--workers",
        default=None,
        type=int,
        help="Number of worker processes to use. Uses the maximum available if unspecified."
    )
    logging_group = parser.add_mutually_exclusive_group()
    logging_group.add_argument(
        "-v",
        "--verbose",
        default=False,
        action="store_true",
        help="Run in verbose mode. Verbose output of debugging information"
    )
    logging_group.add_argument(
        "-q",
        "--quiet",
        default=False,
        action="store_true",
        help="Run in quiet mode. Only output errors."
    )
    return parser

def get_parser():
    parser = argparse.ArgumentParser(description="CDE Harmonization Tools")
    parser.set_defaults(func=lambda _args: parser.print_usage())

    subparsers = parser.add_subparsers(title="Commands")
    make_categorize_parser(subparsers.add_parser("categorize", help="Generate categorical groupings on CDE data dictionaries"))
    make_analyzer_parser(subparsers.add_parser("analyze", help="Perform semantic analysis on categorically-grouped CDE questions"))

    return parser

def main():
    parser = get_parser()
    args = parser.parse_args()

    args.func(args)
    

if __name__ == "__main__":
    main()