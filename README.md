# CDE Harmonization Tools

## Purpose
Tools to aid in the harmonization effort of RADx data elements.

This project consists of two components: tooling for finding potentially harmonizable elements and a webapp for reviewing these findings.  

The harmonization process consists of two steps: grouping and analysis.
1. The purpose of the preliminary grouping stage is to reduce the amount of processing time required for analysis. The goal for this stage is to classify each CDE from the input repository into an indeterminant number of categories. We can consider the grouping stage successful if CDE categories have some degree of overlap, but not excessively so. Note: the entire purpose of this stage is to reduce processing time for analysis. If the groupings are too strict, it can cause possibly harmonizable CDEs to be overlooked during the analysis stage. The current implementations rely on keyword analysis techniques and named entity recognition.
- [KeyBERT](https://github.com/MaartenGr/KeyBERT) (categories from keyword/keyphrase extraction)
- SciGraph (categories from NER annotations)
2. The purpose of the analysis stage is to determine whether two CDEs are likely to be harmonizable. To do this, we want to semantically analyze the similarity of what two CDEs describe. The anlaysis process only analyzes CDEs that have been categorized together.
- [Universal Sentence Encoder](https://arxiv.org/abs/1803.11175) (sentence embeddings)

## Installation
```bash
python3 -m venv venv
source ./venv/bin/activate
pip install -r requirements.txt
```

## Usage
Generating groupings:
```bash
source_file=data/generated/merged.csv
grouping_file_path=generated/$(date +%F)-keybert-groupings.csv
python3 cde_harmonization/cli.py categorize $source_file $grouping_file_path -v -f label -f description -c keybert
```
To get all the options for grouping generation, run `python3 cde_harmonization/cli.py categorize -h`

Running analysis using the groupings:
```bash
score_threshold=0.7
analysis_file_path=generated/$(date +%F)-keybert-analysis-$score_threshold.csv
python3.9 cde_harmonization/cli.py analyze $grouping_file_path $analysis_file_path -a use4 -g intersection -f label -f description -s 0.7 -v
```
To get all the options for grouping generation, run `python3 cde_harmonization/cli.py analyze -h`