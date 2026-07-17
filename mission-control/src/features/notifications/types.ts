export type NotificationSeverity = 'info' | 'warn' | 'error' | 'success'

export type AIOSNotification = {
  id: string
  title: string
  body: string | null
  severity: NotificationSeverity
  link: string | null
  read_at: string | null
  created_at: string
  owner_id: string
}
