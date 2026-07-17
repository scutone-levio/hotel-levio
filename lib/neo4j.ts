import neo4j, { type Driver, type QueryResult } from "neo4j-driver"

type CypherParams = Record<string, unknown>

const globalForNeo4j = globalThis as unknown as {
  neo4jDriver: Driver | undefined
}

function getNeo4jConfig() {
  const uri = process.env.NEO4J_URI
  const user = process.env.NEO4J_USER ?? "neo4j"
  const password = process.env.NEO4J_PASSWORD

  if (!uri) {
    return null
  }
  if (!password) {
    throw new Error("NEO4J_PASSWORD is required when NEO4J_URI is set")
  }

  return { uri, user, password }
}

export function isNeo4jConfigured(): boolean {
  return Boolean(process.env.NEO4J_URI && process.env.NEO4J_PASSWORD)
}

export function getNeo4jDriver(): Driver {
  const config = getNeo4jConfig()
  if (!config) {
    throw new Error(
      "Neo4j is not configured. Set NEO4J_URI and NEO4J_PASSWORD in .env",
    )
  }

  if (!globalForNeo4j.neo4jDriver) {
    globalForNeo4j.neo4jDriver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.user, config.password),
    )
  }

  return globalForNeo4j.neo4jDriver
}

export async function verifyNeo4jConnection(): Promise<boolean> {
  if (!isNeo4jConfigured()) return false

  const driver = getNeo4jDriver()
  await driver.verifyConnectivity()
  return true
}

export async function runReadQuery<TRow extends Record<string, unknown>>(
  cypher: string,
  params: CypherParams = {},
): Promise<TRow[]> {
  const driver = getNeo4jDriver()
  const session = driver.session({ defaultAccessMode: neo4j.session.READ })

  try {
    const result = await session.run(cypher, params)
    return result.records.map((record) => record.toObject() as TRow)
  } finally {
    await session.close()
  }
}

export async function runWriteQuery(
  cypher: string,
  params: CypherParams = {},
): Promise<void> {
  const driver = getNeo4jDriver()
  const session = driver.session({ defaultAccessMode: neo4j.session.WRITE })

  try {
    await session.run(cypher, params)
  } finally {
    await session.close()
  }
}

export async function runWriteTransaction(
  work: (tx: {
    run: (cypher: string, params?: CypherParams) => Promise<QueryResult>
  }) => Promise<void>,
): Promise<void> {
  const driver = getNeo4jDriver()
  const session = driver.session({ defaultAccessMode: neo4j.session.WRITE })

  try {
    await session.executeWrite(async (tx) => {
      await work({
        run: (cypher, params = {}) => tx.run(cypher, params),
      })
    })
  } finally {
    await session.close()
  }
}

export async function closeNeo4jDriver(): Promise<void> {
  if (globalForNeo4j.neo4jDriver) {
    await globalForNeo4j.neo4jDriver.close()
    globalForNeo4j.neo4jDriver = undefined
  }
}
