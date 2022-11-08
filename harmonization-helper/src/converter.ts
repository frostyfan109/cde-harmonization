import ExtendableError from 'es6-error'

interface Matches {
    [id: string]: string
}

interface AnalysisRow {
    [cdeField: string]: any
    categories: string[]
    matches: Matches
    
}
export type AnalysisDict = AnalysisRow[]

export enum HarmonizationDecision {
    REJECTED = "Rejected",
    EXACT_MATCH = "Exact Match",
    MAPPABLE_GROUP = "Mappable Group",
    POSSIBLE_GROUP = "Possible Group",
    HAS_PARENT = "Has Parent"
}
// CDE
export interface AnalysisNode {
    categories: string[]
    [cdeField: string]: any
}
// Match between CDE nodes
export interface AnalysisEdge {
    source: string
    target: string
    score: number
    decision: HarmonizationDecision | null
}
export interface AnalysisNetwork {
    nodes: AnalysisNode[]
    edges: AnalysisEdge[]
}

export class InvalidAnalysisDictError extends ExtendableError {}

export const convertAnalysisDictToNetwork = (analysisDict: AnalysisDict, idField: string): AnalysisNetwork => {
    const net: AnalysisNetwork = {
        nodes: [],
        edges: []
    }
    const edgesToCreate: [string, string, string][] = []
    analysisDict.forEach((row) => {
        const { [idField]: id, categories, matches, ...cdeFields } = row
        if (!id) {
            console.warn("Skipping CDE missing ID field")
            return
        }
        if (!categories || Object.keys(matches).length === 0) {
            throw new InvalidAnalysisDictError()
        }
        net.nodes.push({
            [idField]: id,
            categories,
            ...cdeFields
        })
        Object.entries(matches).forEach(([id2, score]) => edgesToCreate.push([id, id2, score]))
    })
    edgesToCreate.forEach(([id1, id2, score]) => {
        id1 = net.nodes.find((node) => node[idField].endsWith(id1))![idField]
        id2 = net.nodes.find((node) => node[idField].endsWith(id2))![idField]
        net.edges.push({
            source: id1,
            target: id2,
            score: parseFloat(score),
            decision: null
        })
    })
    return net
}