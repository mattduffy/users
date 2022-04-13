require('dotenv').config({ path: './tests/.env' })
const { MongoClient } = require('mongodb')
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const fs = require('fs')

const clientDn = process.env.MONGODB_CLIENT_DN
const dbHost = process.env.MONGODB_HOST
const dbPort = process.env.MONGODB_PORT
const authMechanism = 'MONGODB-X509'
const authSource = '$external'
const clientPEMFile = encodeURIComponent(process.env.MONGODB_CLIENT_KEY)
const dbCAKeyFile = encodeURIComponent(process.env.MONGODB_CAKEYFILE)
const uri = `mongodb://${clientDn}@${dbHost}:${dbPort}/mattmadethese?replicaSet=myReplicaSet&authMechanism=${authMechanism}&tls=true&tlsCertificateKeyFile=${clientPEMFile}&tlsCAFile=${dbCAKeyFile}&authSource=${authSource}`

// console.log(uri)

const client = new MongoClient(uri)

async function run () {
  try {
    await client.connect()
    const database = client.db('mattmadethese')
    const collection = database.collection('test')

    const cursor = await collection.find()
    // console.log(cursor)
    if (collection.estimatedDocumentCount === 0) {
      console.log('no documents found')
    }
    // await cursor.forEach(console.dir)
    return await cursor
  } finally {
    await client.close()
  }
}

// run().catch(console.dir)

async function insertOne () {
  const doc = {
    uid: gID(),
    name: 'Matt',
    email: 'mattduffy@gmail.com',
    password: await bcrypt.hash('monk3ysh', 10),
    jwt: gT()
  }
  console.log(doc)
  try {
    await client.connect()
    const database = client.db('mattmadethese')
    const collection = database.collection('test')
    const result = await collection.insertOne(doc)
    console.log(`document inserted into test collection with _id: ${result.insertedId}`)
  } catch (e) {
    console.error(e)
  } finally {
    await client.close()
  }
}
// insertOne().catch(console.dir)

function gT () {
  const secret = fs.readFileSync('/data/sites/nginx-sites/mattmadethese.com/nodejs/keys/jwt/jwt-private-rsa4096.pem')
  const toptions = { algorithm: 'HS256', expiresIn: '30m', issuer: 'mattmadethese.com', subject: 'matt', audience: 'access', jwtid: gID() }
  const roptions = { algorithm: 'HS256', expiresIn: '5m', issuer: 'mattmadethese.com', subject: 'matt', audience: 'refresh', jwtid: gID() }
  const token = jwt.sign({ email: 'mattduffy@gmail.com' }, secret, toptions)
  const refresh = jwt.sign({ email: 'mattduffy@gmail.com' }, secret, roptions)
  return { token, refresh }
}

function gID () {
  const arr = []
  for (let i = 0; i <= 6; i++) {
    arr.push(crypto.randomBytes(2).toString('hex'))
  }
  return arr.join('-')
}

module.exports = {
  client,
  run,
  insertOne,
  genTokens: gT
}
