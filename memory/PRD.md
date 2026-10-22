# Martins Cabeleireiro — PRD
## Problem
Expo mobile app for barbershop/salon "Martins Cabeleireiro": black & gold theme, logo, slogan, address, hours (Mon–Sat 08–20), WhatsApp FAB (69) 99964-0881, 14 services w/ price & duration, online booking (blocks exact duration, WhatsApp confirmation), admin panel (2 admins), client base w/ .vcf/phone import, eve-of reminders w/ WhatsApp, visit history, block days/holidays.
## Architecture
FastAPI + MongoDB (/api), Expo Router. Admin JWT (bcrypt). Timezone America/Porto_Velho, 15-min slot step.
## Implemented (2026-06)
- Home, booking flow, success + WhatsApp confirm
- Admin: login, Agenda (day nav, concluir/cancelar), Lembretes (tomorrow), Clientes (search, paging, .vcf import, phone import native / Chrome Contact Picker, add, detail w/ history), Ajustes (block days, change password)
- Contatos.vcf pre-imported (1202 clients)
- Booking name field autocomplete from client base (admin logged in only); selecting fills name + phone; manual entry kept
- Admin credentials: martins / #Agora100%, elizama / #Zama2020 (applied in DB)
## Backlog
- P1: Admin edit/reschedule appointment; multiple professionals agenda
- P2: Monthly revenue reports, loyalty program
