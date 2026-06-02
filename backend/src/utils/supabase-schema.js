const normalize = (value) => String(value || '').toLowerCase()

const getErrorText = (error = {}) => [
  error?.message,
  error?.details,
  error?.hint,
  error?.code
].map(normalize).join(' ')

export const isMissingColumnError = (error, table, column) => {
  const text = getErrorText(error)
  const normalizedTable = normalize(table)
  const normalizedColumn = normalize(column)

  return (
    text.includes(`could not find the '${normalizedColumn}' column of '${normalizedTable}'`) ||
    text.includes(`column ${normalizedTable}.${normalizedColumn} does not exist`) ||
    text.includes(`column "${normalizedColumn}" does not exist`) ||
    (text.includes('pgrst204') && text.includes(normalizedTable) && text.includes(normalizedColumn))
  )
}

export const isMissingRelationError = (error, relation) => {
  const text = getErrorText(error)
  const normalizedRelation = normalize(relation)

  return (
    text.includes(`relation "${normalizedRelation}" does not exist`) ||
    text.includes(`relation ${normalizedRelation} does not exist`) ||
    (text.includes('does not exist') && text.includes(normalizedRelation))
  )
}
