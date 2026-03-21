import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native'
import {
  CameraView,
  useCameraPermissions,
} from 'expo-camera'
import { useRouter } from 'expo-router'
import Toast from 'react-native-toast-message'
import nacl from 'tweetnacl'
import {
  useIdentity,
  signPayload,
  b64ToBytes,
} from '../hooks/useIdentity'
import { colors } from '../theme'
import { useAgentContext } from '../AgentContext'

interface AgentQRPayload {
  agentPubKey: string
  signalUrl: string
  roomId: string
  agentName: string
}

export default function PairScreen() {
  const router = useRouter()
  const [permission, requestPermission] =
    useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const [pairing, setPairing] = useState(false)
  const { identity, loading } = useIdentity()
  const { addAgent, agents } = useAgentContext()
  const processingRef = useRef(false)

  const handleScan = async ({ data }: { data: string }) => {
    if (processingRef.current || !identity) return
    processingRef.current = true
    setScanned(true)
    setPairing(true)
    try {
      console.log('[pair] QR raw data:', data)

      const payload: AgentQRPayload = JSON.parse(data)
      if (
        !payload.agentPubKey ||
        !payload.signalUrl ||
        !payload.roomId
      ) {
        throw new Error('Invalid QR code')
      }

      if (agents[payload.roomId]) {
        Toast.show({
          type: 'info',
          text1: 'Already paired',
          text2: `${payload.agentName} is already in your agents list`,
        })
        router.push('/')
        return
      }

      const signalUrlObj = new URL(
        payload.signalUrl
          .replace('ws://', 'http://')
          .replace('wss://', 'https://'),
      )
      const agentBaseUrl = `http://${signalUrlObj.hostname}:8000`
      const pairUrl = `${agentBaseUrl}/api/pair`
      console.log('[pair] signal URL:', payload.signalUrl)
      console.log('[pair] agent base URL:', agentBaseUrl)
      console.log('[pair] POST →', pairUrl)

      const ts = Date.now()
      const pairingPayload = {
        mobilePubKey: identity.publicKeyB64,
        ts,
        deviceName: 'Mobile',
      }
      const sortedKeys = Object.keys(pairingPayload).sort()
      const signedStr = JSON.stringify(
        pairingPayload,
        sortedKeys,
      )
      console.log('[pair] signed string :', signedStr)
      console.log(
        '[pair] pub key       :',
        identity.publicKeyB64,
      )
      const sig = signPayload(pairingPayload, identity)
      console.log('[pair] sig           :', sig)
      const msgBytes = new TextEncoder().encode(signedStr)
      const sigBytes = b64ToBytes(sig)
      const pubKeyBytes = b64ToBytes(identity.publicKeyB64)
      const selfVerify = nacl.sign.detached.verify(
        new Uint8Array(msgBytes),
        new Uint8Array(sigBytes),
        new Uint8Array(pubKeyBytes),
      )
      console.log('[pair] self-verify   :', selfVerify)
      const body = JSON.stringify({
        ...pairingPayload,
        sig,
      })
      console.log(
        '[pair] request body  :',
        body.slice(0, 200),
      )

      const res = await fetch(pairUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })

      console.log('[pair] response status:', res.status)
      const text = await res.text()
      console.log(
        '[pair] response body:',
        text.slice(0, 200),
      )

      if (!res.ok) {
        let detail = text
        try {
          detail = JSON.parse(text).detail ?? text
        } catch {}
        throw new Error(`HTTP ${res.status}: ${detail}`)
      }

      const result = JSON.parse(text)
      await addAgent(payload)
      Alert.alert(
        'Pairing Request Sent',
        result.status === 'already_approved'
          ? 'Device already approved. You can connect now.'
          : 'Approve the connection on your desktop dashboard.',
        [{ text: 'OK', onPress: () => router.push('/') }],
      )
    } catch (e: any) {
      console.error('[pair] error:', e)
      Toast.show({
        type: 'error',
        text1: 'Pairing failed',
        text2: e.message,
        visibilityTime: 6000,
        props: { reportData: `pair error: ${e.message}` },
      })
      setScanned(false)
      processingRef.current = false
    } finally {
      setPairing(false)
    }
  }

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  if (!permission) return <View style={styles.center} />
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>
          Camera permission required to scan QR code
        </Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={requestPermission}
        >
          <Text style={styles.btnText}>
            Grant Permission
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scan Agent QR Code</Text>
      <Text style={styles.subtitle}>
        Open the Nekoni dashboard on your home machine and
        scan the QR code shown there.
      </Text>
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={
            scanned ? undefined : handleScan
          }
        />
        {pairing && (
          <View style={styles.overlay}>
            <ActivityIndicator
              color={colors.accent}
              size="large"
            />
            <Text style={styles.overlayText}>
              Sending pairing request...
            </Text>
          </View>
        )}
      </View>
      {scanned && !pairing && (
        <TouchableOpacity
          style={styles.btn}
          onPress={() => setScanned(false)}
        >
          <Text style={styles.btnText}>Scan Again</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 20,
    alignItems: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
    padding: 20,
  },
  title: {
    color: colors.textHigh,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textMed,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  cameraContainer: {
    width: 280,
    height: 280,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.accent,
  },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg + 'cc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    color: colors.accent,
    marginTop: 12,
    fontSize: 14,
  },
  text: {
    color: colors.textHigh,
    marginBottom: 16,
    textAlign: 'center',
  },
  btn: {
    marginTop: 20,
    backgroundColor: colors.accent,
    padding: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '600' },
})
