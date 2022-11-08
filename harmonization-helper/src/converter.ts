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
// This is the form that is used in state to conserve memory in local storage.
export interface ClusterAnalysisNetwork {
    id: string
    name: string
    nodes: {
        id: string
    }[]
    edges: {
        source: string
        target: string
        decision: HarmonizationDecision | null
    }[]
}
// This is the augmented form that combines the source network data with the cluster data.
// Note that the id returns to the `idField` key in this form.
export interface CompleteClusterAnalysisNetwork extends Omit<ClusterAnalysisNetwork, 'nodes'> {
    nodes: AnalysisNode[]
    edges: (AnalysisEdge & {
        decision: HarmonizationDecision | null
    })[]
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
            score: parseFloat(score)
        })
    })
    return net
}

export const clustersToNetworks = (
    clusters: ClusterAnalysisNetwork[],
    sourceNetwork: AnalysisNetwork,
    idField: string="id"
): CompleteClusterAnalysisNetwork[] => {
    const findSourceNode = (id: string) => sourceNetwork.nodes.find((n) => n[idField] === id)!
    const findSourceEdge = (source: string, target: string) => sourceNetwork.edges.find((e) => e.source === source && e.target === target)!

    return clusters.map((cluster) => ({
        ...cluster,
        // No extra properties needed to map for nodes, just direct one-to-one mapping
        nodes: cluster.nodes.map((n) => findSourceNode(n.id)),
        edges: cluster.edges.map((e) => ({
            ...findSourceEdge(e.source, e.target),
            decision: e.decision
        }))
    }))
}