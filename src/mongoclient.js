/**
 * @module @mattduffy/users
 * @file /src/mongoclient.js
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient, ObjectId } from 'mongodb'
import * as Dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
if (process.env?.MONGODB_CLIENT_DN === undefined) {
  const envPath = path.resolve(__dirname, '../', 'config/mongodb.env')
  // Dotenv.config({ path: './config/mongodb.env', debug: true })
  Dotenv.config({ path: envPath, debug: true })
  // console.log(__filename)
  // console.log(__dirname)
  // console.log(envPath)
  // console.log(process.env.MONGODB_CLIENT_DN)
}

const clientDn = process.env.MONGODB_CLIENT_DN
const dbHost = process.env.MONGODB_HOST
const dbPort1 = process.env.MONGODB_PORT_1
const dbPort2 = process.env.MONGODB_PORT_2
const dbPort3 = process.env.MONGODB_PORT_3
const authMechanism = 'MONGODB-X509'
const authSource = '$external'
const clientPEMFile = encodeURIComponent(process.env.MONGODB_CLIENT_KEY)
const dbCAKeyFile = encodeURIComponent(process.env.MONGODB_CAKEYFILE)
const uri = `mongodb://${clientDn}@${dbHost}:${dbPort1},${dbHost}:${dbPort2},${dbHost}:${dbPort3}/mattmadethese?replicaSet=myReplicaSet&authMechanism=${authMechanism}&tls=true&tlsCertificateKeyFile=${clientPEMFile}&tlsCAFile=${dbCAKeyFile}&authSource=${authSource}`

const client = new MongoClient(uri)

export {
  client,
  ObjectId,
}
