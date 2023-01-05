
const sortDirectionAscending = ['asc', 'ascending', 'true', true];
const enableStatuses = [true, 'e', 'enable'];

const statusCodes = {
  NOT_FOUND: 404,
  OK: 200,
  INTERNAL_SERVER_ERROR: 500,
  DATA_CREATED: 201,
  UNPROCESSABLE_ENTITY: 422,
  NO_CONTENT: 204,
}

module.exports = {
  sortDirectionAscending,
  statusCodes, enableStatuses,
}
