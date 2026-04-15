const sortDirectionAscending = ['asc', 'ascending', 'true', true];
const enableStatuses = [true, 'e', 'enable'];

const timeConstants = {
  MS_PER_SECOND: 1000,
  SECONDS_PER_MINUTE: 60,
};

timeConstants.MS_PER_MINUTE =
  timeConstants.SECONDS_PER_MINUTE * timeConstants.MS_PER_SECOND;

const toyPolicyFallbacks = {
  cleanupIntervalMinutes: 1,
  maxToysPerIp: 5,
  rateLimitWindowMinutes: 5,
  seedMaxToysPerIp: 15,
  seedWindowMinutes: 10,
  toyTtlMinutes: 15,
};

function readPositiveIntegerEnv(envName) {
  const numericValue = Number(process.env[envName]);
  if (!Number.isFinite(numericValue)) return null;

  return Math.max(1, Math.floor(numericValue));
}

function getToyPolicyDefaults() {
  const seedWindowMinutes =
    readPositiveIntegerEnv('DEFAULT_SEED_WINDOW_MINUTES') ??
    toyPolicyFallbacks.seedWindowMinutes;
  const toyTtlMinutes =
    readPositiveIntegerEnv('DEFAULT_TOY_TTL_MINUTES') ??
    toyPolicyFallbacks.toyTtlMinutes;
  const cleanupIntervalMinutes =
    readPositiveIntegerEnv('DEFAULT_TOY_CLEANUP_INTERVAL_MINUTES') ??
    toyPolicyFallbacks.cleanupIntervalMinutes;
  const rateLimitWindowMinutes =
    readPositiveIntegerEnv('DEFAULT_RATE_LIMIT_WINDOW_MINUTES') ??
    toyPolicyFallbacks.rateLimitWindowMinutes;

  return {
    cleanupIntervalMs: cleanupIntervalMinutes * timeConstants.MS_PER_MINUTE,
    maxToysPerIp:
      readPositiveIntegerEnv('DEFAULT_MAX_TOYS_PER_IP') ??
      toyPolicyFallbacks.maxToysPerIp,
    rateLimitWindowMs:
      rateLimitWindowMinutes * timeConstants.MS_PER_MINUTE,
    seedMaxToysPerIp:
      readPositiveIntegerEnv('DEFAULT_SEED_MAX_TOYS_PER_IP') ??
      toyPolicyFallbacks.seedMaxToysPerIp,
    seedWindowMs: seedWindowMinutes * timeConstants.MS_PER_MINUTE,
    toyTtlMs: toyTtlMinutes * timeConstants.MS_PER_MINUTE,
  };
}

const toyConstraints = {
  imageProtocols: ['http:', 'https:'],
  maxNameLength: 120,
  minNameLength: 2,
};

const statusCodes = {
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  OK: 200,
  INTERNAL_SERVER_ERROR: 500,
  DATA_CREATED: 201,
  TOO_MANY_REQUESTS: 429,
  UNAUTHORIZED: 401,
  UNPROCESSABLE_ENTITY: 422,
  NO_CONTENT: 204,
};

module.exports = {
  sortDirectionAscending,
  statusCodes,
  enableStatuses,
  getToyPolicyDefaults,
  timeConstants,
  toyPolicyFallbacks,
  toyConstraints,
};
