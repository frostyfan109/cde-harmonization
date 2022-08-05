import argparse
import logging
from utils import CDELoader

def categorize(args):
    import grouping

    cde_file = args.cde_file
    output_path = args.output_path
    fields = list(set(args.field)) if args.field is not None else ["description"]
    categorizer_name = args.categorizer
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
    if categorizer_name == "concept_analyzer":
        categorizer = grouping.ConceptualAnalysisCategorizer(fields)
    elif categorizer_name == "rake_analyzer":
        categorizer = grouping.RakeKeywordCategorizer(fields)
    elif categorizer_name == "keybert_analyzer":
        categorizer = grouping.KeyBERTCategorizer(fields)
    
    grouped_cde = categorizer.categorize_cde(cde)
    cde_loader.save(grouped_cde, output_path)

def visualize_categories(args):
    import grouping
    cde_file = args.cde_file
    export_gexf = args.output_gexf

    cde_loader = CDELoader(options={
        "csv_parse_lists": ["categories"]
    })
    cde = cde_loader.load(cde_file)
    grouping.visualize_cde(cde, export_gexf=export_gexf)

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
        choices=["concept_analyzer", "rake_analyzer", "keybert_analyzer"],
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

def make_visualization_parser(parser):
    parser.set_defaults(func=visualize_categories)
    parser.add_argument(
        "cde_file",
        type=str,
        help="File path to categorized CDE"
    )
    parser.add_argument(
        "-o",
        "--output_gexf",
        type=str,
        default=None,
        help="File path to export the graph as a GEXF file"
    )
    return parser

def get_parser():
    parser = argparse.ArgumentParser(description="CDE Harmonization Tools")
    parser.set_defaults(func=lambda _args: parser.print_usage())

    subparsers = parser.add_subparsers(title="Commands")
    make_categorize_parser(subparsers.add_parser("categorize", help="Generate categorical groupings on CDE data dictionaries"))
    make_visualization_parser(subparsers.add_parser("category_visualizer", help="Create visualization of generated categorical groupings"))

    return parser

def main():
    parser = get_parser()
    args = parser.parse_args()

    args.func(args)
    

if __name__ == "__main__":
    main()