import { Network, MessageReceiver, TCPNode } from "nest-crdt-tools/network"

import * as http from "http"
import { Server } from "http"

import express from "express"

/**
 * <code>Network</code> which communicates via HTTP.
 * Uses <code>HTTPNode</code>s to specify addresses of its members.
 * Doesn't fulfill the requirement of verifying the sender of a message (yet).
 */
export class HTTPNetwork implements Network<TCPNode> {
	
	private static readonly HTTP_PATH: string = '/'
	
	private readonly server: Server = null
	
	private readonly nodes: Record<string, TCPNode> = {}
	
	private readonly receiversByTopic: Map<string, MessageReceiver> = new Map()
	
	private readonly id: string
	
	
	constructor(ownId: string, ownNode: TCPNode) {
		this.id = ownId
		
		const app = express()
		
		app.use(express.text())
		
		app.post(HTTPNetwork.HTTP_PATH, async (req, res) => {
			const { id: senderId, topic, message } = JSON.parse(req.body)
			
			const receive = this.receiversByTopic.get(topic)
			
			if (receive) {
				await receive(senderId, message)
				res.sendStatus(200)
			} else {
				res.sendStatus(404)
			}
		})
		
		this.server = app.listen(ownNode.port, () => {})
	}
	
	async stop() {
		this.server.close()
	}
	
	async registerNode(id: string, node: TCPNode): Promise<void> {
		this.nodes[id] = node
	}
	
	async registerReceiver(topic: string, receiver: MessageReceiver): Promise<void> {
		this.receiversByTopic.set(topic, receiver)
	}
	
	async sendMessage(targetId: string, topic: string, message: any): Promise<void> {
		if (targetId != this.id) {
			const targetNode = this.nodes[targetId]
			HTTPNetwork.post(
				targetNode,
				JSON.stringify({ id: this.id, topic, message })
			)
		} else {
			const receive = this.receiversByTopic.get(topic)
			if (receive) {
				await receive(targetId, message)
			}
		}
	}
	
	private static post(
		target: TCPNode,
		data: string
	): void {
		const request = http.request(
			{
				host: target.host,
				port: target.port,
				path: HTTPNetwork.HTTP_PATH,
				method: 'POST',
				protocol: 'http:',
				headers: {
					'Content-Type': 'text/plain',
					'Content-Length': data.length
				}
			},
			_ => {}
		)
		request.write(data)
		request.end()
	}
	
}
