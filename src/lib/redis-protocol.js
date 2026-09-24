// These scripts are shared by the server and integration tests. A lost owner
// cannot renew another node's lease or publish a challenge after a long pause.
export const RENEW_OR_ACQUIRE_LEASE = `
local owner = redis.call('GET', KEYS[1])
if owner == ARGV[1] then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
  return 1
end
if not owner then
  redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
  return 1
end
return 0`;

export const PUBLISH_CHALLENGE = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
redis.call('SET', KEYS[2], ARGV[1], 'PX', ARGV[2])
redis.call('SET', KEYS[3], ARGV[3], 'EX', 90)
redis.call('PUBLISH', ARGV[4], ARGV[3])
return 1`;

export const CONSUME_RATE_LIMIT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 or redis.call('TTL', KEYS[1]) < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return {count, redis.call('TTL', KEYS[1])}`;
