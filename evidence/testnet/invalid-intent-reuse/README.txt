These two receipts are preserved for audit but excluded from Arc Testnet acceptance.

The first full-matrix harness draft reused the hero timeout-after human intent IDs. On the fixed fixture, both calls therefore correctly reverted because the hero had already settled that intent. The unsafe calls also reused a previously paid obligation. The harness was corrected to give each full-matrix timeout-after run its own intent IDs, and the live chain was not reset. See the valid `timeout-after-unsafe` and `timeout-after-fixed` evidence directories outside this folder.
