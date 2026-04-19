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
// console.log('__filename', __filename)
// console.log('__dirname', __dirname)
// console.log('process.env.mongodb_client_dn', process.env?.MONGODB_CLIENT_DN)
if (process.env?.MONGODB_CLIENT_DN === undefined) {
  const envPath = path.resolve(__dirname, '../', 'config/mongodb.env')
  Dotenv.config({ path: envPath, debug: true })
  console.log(envPath)
}

const clientDn = process.env.MONGODB_CLIENT_DN
const dbHost1 = process.env.MONGODB_HOST_1
const dbHost2 = process.env.MONGODB_HOST_2
const dbHost3 = process.env.MONGODB_HOST_3
const dbPort1 = process.env.MONGODB_PORT_1
const dbPort2 = process.env.MONGODB_PORT_2
const dbPort3 = process.env.MONGODB_PORT_3
const authMechanism = 'MONGODB-X509'
const authSource = '$external'
const clientPEMFile = encodeURIComponent(process.env.MONGODB_CLIENT_KEY)
const dbCAKeyFile = encodeURIComponent(process.env.MONGODB_CAKEYFILE)
const uri = `mongodb://${clientDn}@`
  + `${dbHost1}:${dbPort1},${dbHost2}:${dbPort2},${dbHost3}:${dbPort3}/`
  + 'mattmadethese?'
  + 'replicaSet=myReplicaSet&'
  + `authMechanism=${authMechanism}&`
  + 'tls=true&'
  + `tlsCertificateKeyFile=${clientPEMFile}&`
  + `tlsCAFile=${dbCAKeyFile}&`
  + `authSource=${authSource}`
// console.log('mongodb connection URI', uri)
const client = new MongoClient(uri)

export {
  client,
  ObjectId,
}
