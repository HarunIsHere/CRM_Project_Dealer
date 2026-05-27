#!/bin/zsh

exec cloudflared tunnel --config /Users/harun/.cloudflared/crm-dealer.yml run crm-dealer
