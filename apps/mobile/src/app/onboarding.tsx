import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { colors } from '../theme'

const steps = [
  {
    number: '1',
    title: 'Run the agent on your computer',
    body: 'Install nekoni on any Mac, Linux, or Windows machine on your home network.',
  },
  {
    number: '2',
    title: 'Open the dashboard and pair',
    body: 'The dashboard shows a QR code. Tap "Pair Agent" and scan it to link your phone.',
  },
  {
    number: '3',
    title: 'Chat privately',
    body: 'Messages go directly to your machine over an encrypted P2P connection.',
  },
]

export default function OnboardingScreen() {
  const router = useRouter()

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
        />
        <Text style={styles.title}>nekoni</Text>
        <Text style={styles.tagline}>
          Your private AI on your home machine.{'\n'}No cloud. No subscriptions.
        </Text>
      </View>

      <View style={styles.steps}>
        {steps.map((step) => (
          <View key={step.number} style={styles.step}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{step.number}</Text>
            </View>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDesc}>{step.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/pair')}
        >
          <Text style={styles.primaryBtnText}>Pair Agent</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ghostBtn}
          onPress={() => Linking.openURL('https://nekoni.dev')}
        >
          <Text style={styles.ghostBtnText}>Learn more at nekoni.dev</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 20,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    paddingTop: 24,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 16,
    marginBottom: 10,
  },
  title: {
    color: colors.textHigh,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  tagline: {
    color: colors.textMed,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  steps: {
    gap: 10,
  },
  step: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent + '22',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 12,
  },
  stepBody: {
    flex: 1,
  },
  stepTitle: {
    color: colors.textHigh,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  stepDesc: {
    color: colors.textMed,
    fontSize: 12,
    lineHeight: 17,
  },
  actions: {
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  ghostBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  ghostBtnText: {
    color: colors.textMed,
    fontSize: 13,
  },
})
