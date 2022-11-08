import { useMemo, useState } from 'react'
import { Button } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { SizeMe } from 'react-sizeme'
import chroma from 'chroma-js'
import ForceGraph2D from 'react-force-graph-2d'
import { useApp } from './app-context'
import './network-graph.css'

const SettingsButton = ({ onClick }) => {
    return (
        <Button size="large" type="text" icon={ <SettingOutlined /> } onClick={ onClick } />
    )
}

export const NetworkGraph = ({ }) => {
    const { analysis, activeCommunityAlgorithm, graphData, networkRef } = useApp()
    const [showSettingsModal, setShowSettingsModal] = useState(false)

    const idField = useMemo(() => analysis?.metadata.idField, [analysis])
    
    const displayFields = useMemo(() => (idField ? [
        // idField,
        "description",
        "label"
    ] : []), [idField])

    const forceGraphProps = useMemo(() => ({
        graphData,
        nodeId: idField,
        nodeLabel: (node) => `
            <div class="node-tooltip" style="width: 100%;">
                <div class="node-tooltip-title" style="word-break: break-all;">${ node.variable_name }</div>
                <div class="ant-divider ant-divider-horizontal ant-divider-dashed"></div>
                <ul>
                    ${ displayFields.map((fieldName) => "<li style='word-break: break-all;'>" + fieldName + ": " + node[fieldName] + "</li>" ).join("\n") }
                </ul>
            </div>
        `,
        nodeAutoColorBy: (node) => activeCommunityAlgorithm.clusters.findIndex((c) => !!c.nodes.find((n) => n[idField] === node[idField])),
        linkLabel: (link) => "Score: " + link.score,
        // linkColor={ (link) => "rgba(" + chroma('#2e11d4').alpha(link.score).rgba() + ")" }
        linkWidth: 1,
        minZoom: 0.125,
        maxZoom: 50,
        ref: networkRef
    }), [ graphData, idField, networkRef, activeCommunityAlgorithm ])

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
        </div>
    )
}