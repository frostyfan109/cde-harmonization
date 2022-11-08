import netClustering from 'netclustering'
import { AnalysisEdge, AnalysisNetwork, AnalysisNode } from './converter'

interface NewmanGroupedNode extends AnalysisNode {
    cluster: string
}
export function newmanCluster(net: AnalysisNetwork, idField: string="id"): AnalysisNetwork[] {
    const edgeEncodings: { [key: string]: number } = {}
    // The clustering algorithm mutates the objects.
    const nodes: AnalysisNode[] = JSON.parse(JSON.stringify(net.nodes))
    const edges: { source: number, target: number, count: number }[] = []
    net.edges.forEach(({ source, target }) => edges.push({
        source: nodes.findIndex((n) => n[idField] === source),
        target: nodes.findIndex((n) => n[idField] === target),
        count: 1
    }))
    netClustering.cluster(nodes, edges)
    const clusteredNodes = Object.values(
        (nodes as NewmanGroupedNode[]).reduce((acc: { [clusterId: string] : NewmanGroupedNode[] }, cur: NewmanGroupedNode) => {
            const clusterId = cur.cluster
            if (acc.hasOwnProperty(clusterId)) acc[clusterId].push(cur)
            else acc[clusterId] = [cur]
            return acc
        }, {})
    )
    return clusteredNodes.map((clusteredNodes) => {
        const originalNodes = clusteredNodes.map((node) => net.nodes.find((_node) => _node[idField] === node[idField])!)
        const net2 = {
            nodes: originalNodes,
            edges: originalNodes.flatMap((node) => net.edges.filter(({ source }) => node[idField] === source))
        }
        return net2
    })
}

export function connectedComponents(net: AnalysisNetwork, idField: string="id"): AnalysisNetwork[] {
    const V = net.nodes.length
    const adjListArray: number[][] = [...new Array(V)].map(() => ([]))
    const edgeEncodings: { [key: string]: number } = {}
    let i = 0
    const addEdge = (e: AnalysisEdge) => {
        const { source, target } = e 
        let src, dest
        if (edgeEncodings.hasOwnProperty(source)) {
            src = edgeEncodings[source]
        } else {
            src = i
            edgeEncodings[source] = i++
        }
        if (edgeEncodings.hasOwnProperty(target)) {
            dest = edgeEncodings[target]
        } else {
            dest = i
            edgeEncodings[target] = i++
        }
        adjListArray[src].push(dest)
        adjListArray[dest].push(src)
    }
    const DFS = (v: number, visited: boolean[], conn: number[]=[]): number[] => {
        visited[v] = true
        conn.push(v)
        for (let i=0; i<adjListArray[v].length; i++) {
            if (!visited[adjListArray[v][i]]) {
                conn = DFS(adjListArray[v][i], visited, conn)
            }
        }
        return conn
    }
    const visited = [...new Array(V)].map(() => false)
    let connectedComponents = []

    net.edges.forEach((edge) => addEdge(edge))

    for (let v=0; v<V; ++v) {
        if (!visited[v]) {
            connectedComponents.push(DFS(v, visited))
        }
    }

    return connectedComponents
        .map((components) => {
            const nodeIds = components.map((id) => Object.keys(edgeEncodings).find((x) => edgeEncodings[x] === id) )
            const nodes = nodeIds.map((nodeId) => net.nodes.find((n) => n[idField] === nodeId)!)
            const net2 = {
                nodes,
                edges: nodes.flatMap((node) => net.edges.filter(({ source, target }) => node[idField] === source))
            }
            return net2
        })
}