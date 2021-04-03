import express from 'express'
import path from 'path'
import cors from 'cors'
import bodyParser from 'body-parser'
import sockjs from 'sockjs'
import { renderToStaticNodeStream } from 'react-dom/server'
import React from 'react'
import axios from 'axios'

import cookieParser from 'cookie-parser'
import config from './config'
import Html from '../client/html'

const { writeFile, readFile, stat } = require('fs').promises

require('colors')

let Root
try {
  // eslint-disable-next-line import/no-unresolved
  Root = require('../dist/assets/js/ssr/root.bundle').default
} catch {
  console.log('SSR not found. Please run "yarn run build:ssr"'.red)
}

let connections = []

const port = process.env.PORT || 8090
const server = express()

const setHeaders = (req, res, next) => {
  res.set('x-skillcrucial-user', '9014abd2-0916-4eab-adc0-f65959f79224')
  res.set('Access-Control-Expose-Headers', 'X-SKILLCRUCIAL-USER')
  next()
}

const middleware = [
  cors(),
  express.static(path.resolve(__dirname, '../dist/assets')),
  bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }),
  bodyParser.json({ limit: '50mb', extended: true }),
  cookieParser(),
  setHeaders
]

middleware.forEach((it) => server.use(it))

// server.get('/api/v1/users', async (req, res) => {
  
//   const users = await readFile(`${__dirname}/data/users.json`, { encoding: 'utf8' })
//     .then(text => {
//       console.log('read file')
//       return JSON.parse(text)
//     })
//     .catch(async () => {
//       console.log('no file')
//       const url = 'https://jsonplaceholder.typicode.com/users'
//       const { data } = await axios(url).catch((err) => console.log(err))

//       writeFile(`${__dirname}/data/users.json`, JSON.stringify(data), { encoding: 'utf8' })
//       return data
//     })
//   res.json(users)
// })

server.get('/api/v1/users', (req, res) => {
  stat(`${__dirname}/test.json`)
    .then(() => {
      readFile(`${__dirname}/data/users.json`, { encoding: 'utf8' })
        .then((text) => {
          console.log('read file', `${__dirname}/data/users.json`)
          res.json(JSON.parse(text))
        })
        .catch(async (err) => {
          console.log('Reading ERROR ', err)
        })
    })
    .catch(async () => {
      console.log('no file');
      const { data: users } = await axios('http://jsonplaceholder.typicode.com/users')
      writeFile(`${__dirname}/data/users.json`, JSON.stringify(users), {
        encoding: 'utf8'
      })
      res.json(users)
    })
})

server.post('/api/v1/users', async (req, res) => {
  const user = req.body
  const text = await readFile(`${__dirname}/data/users.json`, { encoding: 'utf8' })
  const users = JSON.parse(text)
  const id = +users[users.length-1].id + 1
  users.push({ ...user, id })
  writeFile(`${__dirname}/data/users.json`, JSON.stringify(users), {encoding: 'utf8'})
  res.json({ status: 'success', id })
})

server.get('/api/v1/ok', (req, res) => {
  res.json({ status: 'Ok' })
})

server.use('/api/', (req, res) => {
  res.status(404)
  res.end()
})

const [htmlStart, htmlEnd] = Html({
  body: 'separator',
  title: 'Skillcrucial'
}).split('separator')

server.get('/', (req, res) => {
  const appStream = renderToStaticNodeStream(<Root location={req.url} context={{}} />)
  res.write(htmlStart)
  appStream.pipe(res, { end: false })
  appStream.on('end', () => {
    res.write(htmlEnd)
    res.end()
  })
})

server.get('/*', (req, res) => {
  const appStream = renderToStaticNodeStream(<Root location={req.url} context={{}} />)
  res.write(htmlStart)
  appStream.pipe(res, { end: false })
  appStream.on('end', () => {
    res.write(htmlEnd)
    res.end()
  })
})

const app = server.listen(port)

if (config.isSocketsEnabled) {
  const echo = sockjs.createServer()
  echo.on('connection', (conn) => {
    connections.push(conn)
    conn.on('data', async () => {})

    conn.on('close', () => {
      connections = connections.filter((c) => c.readyState !== 3)
    })
  })
  echo.installHandlers(app, { prefix: '/ws' })
}
console.log(`Serving at show::: http://localhost:${port}`)
