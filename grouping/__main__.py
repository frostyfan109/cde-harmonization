if __name__ == "__main__":
    import argparse
    import logging
    from . import *

    parser = argparse.ArgumentParser(description="Generate categorical groupings on CDE fields")
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
        default="concept_analyzer",
        type=str,
        choices=["concept_analyzer"],
        help="Categorization algorithm to employ in the grouping of CDE fields"
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

    args = parser.parse_args()
    cde_file = args.cde_file
    output_path = args.output_path
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
        categorizer = ConceptualAnalysisCategorizer()
    
    grouped_cde = categorizer.categorize_cde(cde)
    cde_loader.save(grouped_cde, output_path)