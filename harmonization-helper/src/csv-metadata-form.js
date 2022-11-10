import { useState, useEffect } from 'react'
import { Space, Input, Checkbox } from 'antd'

export const AnalysisCSVMetadataForm = ({ onChange }) => {
    const [nameField, setNameField] = useState("variable_name")
    const [idField, setIdField] = useState("Digest (variable_name|source_file|source_directory)")
    const [listDelimiter, setListDelimiter] = useState(",")
    const [dictDelimiter, setDictDelimiter] = useState(";")
    const [transitiveMatches, setTransitiveMatches] = useState(false)
  
    useEffect(() => {
      onChange({
        nameField,
        idField,
        listDelimiter,
        dictDelimiter,
        transitiveMatches
      })
    }, [idField, listDelimiter, dictDelimiter, transitiveMatches])
  
    return (
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          Name field <Input value={ nameField } onChange={ (e) => setNameField(e.target.value) } />
        </Space>
        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          ID field <Input value={ idField } onChange={ (e) => setIdField(e.target.value) } />
        </Space>
        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          List delimiter <Input value={ listDelimiter } onChange={ (e) => setListDelimiter(e.target.value) } />
        </Space>
        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          Dict delimiter <Input value={ dictDelimiter } onChange={ (e) => setDictDelimiter(e.target.value) } />
        </Space>
        <Space direction="vertical" size="small" style={{ width: "100%" }}>
           <Checkbox checked={ transitiveMatches } onChange={ () => setTransitiveMatches(!transitiveMatches) }>
             Transitive matches
            </Checkbox>
            <small style={{ display: "inline-block", marginTop: -4 }}>Creates an edge between every unique node pair (n1, n2) in each cluster. n(n-1)/2 edges per cluster.</small>
        </Space>
      </Space>
    )
  }