import { useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, Modal, Space, Tabs } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { SizeMe } from 'react-sizeme'
import chroma from 'chroma-js'
import ForceGraph2D from 'react-force-graph-2d'
import { useDeepCompareMemo } from 'use-deep-compare'
import { DEFAULT_HARMONZIATION_FIELDS, useApp } from './app-context'
import { lerp, minMaxNorm } from './util'
import './network-graph.css'

const SettingsButton = ({ onClick }) => {
    return (
        <Button size="large" type="text" icon={ <SettingOutlined /> } onClick={ onClick } />
    )
}

export const NetworkGraph = ({ }) => {
    const { analysis, activeCommunityAlgorithm, activeCluster, graphData, networkRef, harmonizationFields: displayFields, setHarmonizationFields } = useApp()
    const [showSettingsModal, setShowSettingsModal] = useState(false)

    const allFields = useMemo(() => analysis ? analysis.network.nodes.reduce((acc, node) => {
        Object.keys(node).forEach((field) => {
            if (!acc.includes(field)) acc.push(field)
        })
        return acc
    }, []) : [], [analysis?.network.nodes])

    const idField = useMemo(() => analysis?.metadata.idField, [analysis])
    const nameField = useMemo(() => analysis?.metadata.nameField, [analysis])
    // Create a map from node id -> cluster id, color nodes based on the cluster they belong to.
    const nodeAutoColorMap = useMemo(() => activeCommunityAlgorithm ? Object.fromEntries(
        activeCommunityAlgorithm.clusters.flatMap((cluster) => cluster.nodes.map((node) => ([
            node.id,
            cluster.id
        ])))
    ) : {}, [activeCommunityAlgorithm])

    const activeClusterNodeIds = useMemo(() => activeCluster?.nodes.map((n) => n.id), [activeCluster])
    const activeClusterEdgeIds = useMemo(() => activeCluster?.edges.map((e) => ([ e.source, e.target ])), [activeCluster])
    
    const forceGraphProps = useDeepCompareMemo(() => ({
        graphData,
        nodeId: idField,
        nodeLabel: (node) => `
            <div class="node-tooltip" style="width: 100%;">
                <div class="node-tooltip-title" style="word-break: break-all;">${ node.variable_name }</div>
                <div class="ant-divider ant-divider-horizontal ant-divider-dashed" style="margin-top: 2px; margin-bottom: 6px;"></div>
                <ul>
                    ${ displayFields.map((fieldName) => "<li style='word-break: break-all;'>" + fieldName + ": " + node[fieldName] + "</li>" ).join("\n") }
                </ul>
            </div>
        `,
        nodeAutoColorBy: (node) => nodeAutoColorMap[node[idField]],
        nodeCanvasObjectMode: () => "after",
        nodeCanvasObject: (node, ctx, globalScale) => {
            if (globalScale < 1) return
            const opacity = lerp(0, 0.85, Math.min(minMaxNorm(globalScale, 1, 2), 1))
            // if (!activeCluster?.nodes.find((n) => n.id === node[idField])) return
            const label = node[nameField]
            const fontSize = 12 / globalScale
            ctx.font = `${ 3 }px Sans-Serif`
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            ctx.fillStyle = `rgba(0, 0, 0, ${ opacity })`
            ctx.fillText(label, node.x, node.y + 8)
        },
        linkLabel: (link) => "Score: " + link.score,
        linkCanvasObjectMode: () => "after",
        linkCanvasObject: (link, ctx, globalScale) => {
            if (globalScale < 1) return
            const { source: start, target: end } = link
            if (typeof start !== "object" || typeof end !== "object") return
            
            const opacity = lerp(0, 0.45, Math.min(minMaxNorm(globalScale, 1, 2), 1))
            
            const textPos = Object.assign(...["x", "y"].map((c) => ({
                [c]: start[c] + (end[c] - start[c]) / 2
            })))

            const relLink = { x: end.x - start.x, y: end.y - start.y }

            let textAngle = Math.atan2(relLink.y, relLink.x)
            if (textAngle > Math.PI / 2) textAngle = -(Math.PI - textAngle)
            if (textAngle < -Math.PI / 2) textAngle = -(-Math.PI - textAngle)

            const label = `${ link.score }`
            
            ctx.font = `${ 3 }px Sans-Serif`
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            ctx.fillStyle = `rgba(0, 0, 0, ${ opacity })`
            ctx.save()
            ctx.translate(textPos.x, textPos.y)
            ctx.rotate(textAngle)
            ctx.fillText(label, 0, -2)
            ctx.restore()
        },
        // linkColor={ (link) => "rgba(" + chroma('#2e11d4').alpha(link.score).rgba() + ")" }
        linkWidth: 1,
        minZoom: 0.125,
        maxZoom: 50,
        ref: networkRef
    }), [ graphData, activeCluster, idField, nameField, nodeAutoColorMap, displayFields ])

    return (
        <div className="network-container" style={{
            display: "flex",
            alignItems: "stretch",
            height: "100%",
            width: "100%",
            position: "relative"
        }}>
            <div style={{ position: "absolute", top: 4, right: 4, zIndex: 1 }}>
                <SettingsButton onClick={ () => setShowSettingsModal(true) } />
            </div>
            <SizeMe monitorHeight>
                { ({ size }) => (
                    <div style={{ width: "100%" }}>
                        <ForceGraph2D
                            width={ size.width }
                            height={ size.height }
                            { ...forceGraphProps }
                        />
                    </div>
                ) }
            </SizeMe>
            <Modal
                title="Settings"
                okText="Save"
                cancelButtonProps={{ style: { display: "none" }}}
                open={ showSettingsModal }
                onOk={ () => setShowSettingsModal(false) }
                onCancel={ () => setShowSettingsModal(false) }
                bodyStyle={{ paddingTop: 0 }}
            >
                <Tabs
                    items={[
                        {
                            key: "harmonization-fields",
                            label: "Harmonization Fields" ,
                            children: (
                                <div>
                                    <Checkbox.Group
                                        options={
                                            allFields.map((field) => ({
                                                label: field,
                                                value: field,
                                                style: { marginBottom: 8 }
                                            }))
                                        }
                                        value={ displayFields }
                                        onChange={ (fields) => setHarmonizationFields(fields) }
                                    />
                                    <Button
                                        type="default"
                                        onClick={ () => setHarmonizationFields(DEFAULT_HARMONZIATION_FIELDS) }
                                        style={{ marginTop: 8 }}
                                    >
                                        Reset
                                    </Button>
                                </div>
                            )
                        }
                    ]}
                />
            </Modal>
        </div>
    )
}