import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => ({
    isSettingsOpen: false,
    isConfirmOpen: false,
    confirmTitle: 'Are you sure?',
    confirmMessage: '',
    confirmConfirmText: 'Confirm',
    confirmCancelText: 'Cancel',
    confirmIsDestructive: false,
    confirmId: 0,
    confirmResult: null as null | boolean,
    confirmResultId: 0,
  }),
  actions: {
    openSettings() {
      this.isSettingsOpen = true
    },
    closeSettings() {
      this.isSettingsOpen = false
    },
    confirmAction(payload?: {
      title?: string
      message?: string
      confirmText?: string
      cancelText?: string
      destructive?: boolean
    }) {
      this.confirmId += 1
      this.confirmResult = null
      this.confirmTitle = payload?.title ?? 'Are you sure?'
      this.confirmMessage = payload?.message ?? ''
      this.confirmConfirmText = payload?.confirmText ?? 'Confirm'
      this.confirmCancelText = payload?.cancelText ?? 'Cancel'
      this.confirmIsDestructive = payload?.destructive ?? false
      this.isConfirmOpen = true
      return this.confirmId
    },
    resolveConfirm(result: boolean) {
      this.isConfirmOpen = false
      this.confirmResult = result
      this.confirmResultId = this.confirmId
    },
  },
})
