# Chrome Extensions Host

Self-hosted Chrome extensions with force-install policy.

## Extensions

| Extension | ID | Version |
|-----------|-----|---------|
| blocktube | `ihccgmhcebgppmpkmccmnmldjdocnffd` | 0.4.6 |
| stayfocusd | `ibkblmdkbeehomgailhdlbalnpkfcpbk` | 4.3.2 |

## Installation

1. Enable GitHub Pages for this repository (Settings → Pages → Source: main branch)
2. Copy `com.google.Chrome.plist` to `/Library/Managed Preferences/`
3. Restart Chrome

```bash
sudo cp com.google.Chrome.plist "/Library/Managed Preferences/"
sudo chmod 644 "/Library/Managed Preferences/com.google.Chrome.plist"
```
