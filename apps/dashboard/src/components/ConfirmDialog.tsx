import React from 'react'
import { AlertDialog, Button, Flex } from '@radix-ui/themes'

interface Props {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: Props) => (
  <AlertDialog.Root open={open} onOpenChange={v => { if (!v) onCancel() }}>
    <AlertDialog.Content maxWidth="400px">
      <AlertDialog.Title>{title}</AlertDialog.Title>
      <AlertDialog.Description>{description}</AlertDialog.Description>
      <Flex gap="3" justify="end" mt="4">
        <AlertDialog.Cancel>
          <Button variant="soft" color="gray" onClick={onCancel}>Cancel</Button>
        </AlertDialog.Cancel>
        <AlertDialog.Action>
          <Button color="red" variant="soft" onClick={onConfirm}>{confirmLabel}</Button>
        </AlertDialog.Action>
      </Flex>
    </AlertDialog.Content>
  </AlertDialog.Root>
)
