import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Share,
  Platform,
  StyleSheet,
} from 'react-native'
import { ToastConfigParams } from 'react-native-toast-message'
import { colors } from '../theme'

interface ToastProps {
  reportData?: string
}

const ErrorToast = ({
  text1,
  text2,
  props,
}: ToastConfigParams<ToastProps>) => {
  const handleReport = async () => {
    const lines = [
      `nekoni error report`,
      `---`,
      `time: ${new Date().toISOString()}`,
      `platform: ${Platform.OS} ${Platform.Version}`,
      `error: ${text1}`,
      text2 ? `detail: ${text2}` : null,
      props?.reportData
        ? `\n${props.reportData}`
        : null,
    ]
      .filter(Boolean)
      .join('\n')

    await Share.share({ message: lines })
  }

  return (
    <View style={[styles.toast, styles.errorToast]}>
      <View style={styles.indicator} />
      <View style={styles.body}>
        <Text
          style={styles.title}
          numberOfLines={1}
        >
          {text1}
        </Text>
        {text2 ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {text2}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        style={styles.reportBtn}
        onPress={handleReport}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.reportBtnText}>Report</Text>
      </TouchableOpacity>
    </View>
  )
}

const InfoToast = ({
  text1,
  text2,
}: ToastConfigParams<ToastProps>) => (
  <View style={[styles.toast, styles.infoToast]}>
    <View
      style={[styles.indicator, styles.infoIndicator]}
    />
    <View style={styles.body}>
      <Text style={styles.title} numberOfLines={1}>
        {text1}
      </Text>
      {text2 ? (
        <Text style={styles.subtitle} numberOfLines={2}>
          {text2}
        </Text>
      ) : null}
    </View>
  </View>
)

const SuccessToast = ({
  text1,
  text2,
}: ToastConfigParams<ToastProps>) => (
  <View style={[styles.toast, styles.successToast]}>
    <View
      style={[styles.indicator, styles.successIndicator]}
    />
    <View style={styles.body}>
      <Text style={styles.title} numberOfLines={1}>
        {text1}
      </Text>
      {text2 ? (
        <Text style={styles.subtitle} numberOfLines={2}>
          {text2}
        </Text>
      ) : null}
    </View>
  </View>
)

export const toastConfig = {
  error: (params: ToastConfigParams<ToastProps>) => (
    <ErrorToast {...params} />
  ),
  info: (params: ToastConfigParams<ToastProps>) => (
    <InfoToast {...params} />
  ),
  success: (params: ToastConfigParams<ToastProps>) => (
    <SuccessToast {...params} />
  ),
}

const styles = StyleSheet.create({
  toast: {
    width: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  errorToast: { borderLeftColor: colors.red },
  infoToast: { borderLeftColor: colors.accent },
  successToast: { borderLeftColor: colors.green },
  indicator: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginHorizontal: 12,
    backgroundColor: colors.red,
  },
  infoIndicator: { backgroundColor: colors.accent },
  successIndicator: { backgroundColor: colors.green },
  body: { flex: 1, gap: 2 },
  title: {
    color: colors.textHigh,
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    color: colors.textMed,
    fontSize: 12,
    lineHeight: 16,
  },
  reportBtn: {
    marginLeft: 10,
    backgroundColor: colors.redSurface,
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  reportBtnText: {
    color: colors.red,
    fontSize: 12,
    fontWeight: '600',
  },
})
