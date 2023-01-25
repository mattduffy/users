import { MongoClient, ObjectId } from 'mongodb'
import * as Dotenv from 'dotenv'

Dotenv.config({ path: './config/mongodb.env', debug: true })

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
