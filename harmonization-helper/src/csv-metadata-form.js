import { useState, useEffect } from 'react'
import { Space, Input } from 'antd'

export const AnalysisCSVMetadataForm = ({ onChange }) => {
    const [idField, setIdField] = useState("Digest (variable_name|source_file|source_directory)")
    const [listDelimiter, setListDelimiter] = useState(",")
    const [dictDelimiter, setDictDelimiter] = useState(";")
  
    useEffect(() => {
      onChange({
        idField,
        listDelimiter,
        dictDelimiter
      })
    }, [idField, listDelimiter, dictDelimiter])
  
    return (
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          ID field <Input value={ idField } onChange={ (e) => setIdField(e.target.value) } />
        </Space>
        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          List delimiter <Input value={ listDelimiter } onChange={ (e) => setListDelimiter(e.target.value) } />
        </Space>
        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          Dict delimiter <Input value={ dictDelimiter } onChange={ (e) => setDictDelimiter(e.target.value) } />
        </Space>
      </Space>
    )
  }