/**
 * Signaling message types for WebRTC peer negotiation.
 * All messages from authenticated peers include a signature.
 * sig = base64(Ed25519Sign(sha256(JSON.stringify(payload_without_sig)), senderPrivKey))
 */

export type SignalMessage =
  | JoinMessage
  | OfferMessage
  | AnswerMessage
  | IceMessage
  | PeerJoinedMessage
  | PeerLeftMessage
  | ErrorMessage

export interface JoinMessage {
  type: "join"
  roomId: string
  clientId: string
  pubKey: string
  ts: number
  sig: string
}

export interface OfferMessage {
  type: "offer"
  sdp: string
  from: string
  to: string
  ts: number
  sig: string
}

export interface AnswerMessage {
  type: "answer"
  sdp: string
  from: string
  to: string
  ts: number
  sig: string
}

export interface IceMessage {
  type: "ice"
  candidate: RTCIceCandidateInit
  from: string
  to: string
  ts: number
  sig: string
}

export interface PeerJoinedMessage {
  type: "peer_joined"
  clientId: string
  pubKey: string
}

export interface PeerLeftMessage {
  type: "peer_left"
  clientId: string
  pubKey: string
}

export interface ErrorMessage {
  type: "error"
  code: string
  message: string
}

/** QR Code payload – rendered by dashboard, scanned by mobile */
export interface AgentQRPayload {
  agentPubKey: string   // base64url Ed25519 public key
  signalUrl: string     // ws://192.168.x.x:3000
  roomId: string
  agentName: string
}

/** Pairing request sent from mobile to agent REST API */
export interface PairingRequest {
  mobilePubKey: string  // base64url Ed25519 public key
  sig: string           // base64url sign(ts_string, mobilePrivKey)
  ts: number
  deviceName?: string
}

/** Pairing approval sent from dashboard to agent REST API */
export interface PairingApproval {
  mobilePubKey: string
  approved: boolean
}

/** Approved device record */
export interface ApprovedDevice {
  mobilePubKey: string
  deviceName?: string
  approvedAt: number
}
