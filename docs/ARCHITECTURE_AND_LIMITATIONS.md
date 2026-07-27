# Architecture Assumptions and Known Limitations

## Architecture Summary

Stellar-star uses:

- Next.js + TypeScript frontend
- Supabase for app data and realtime sync
- Stellar payment operations for value transfer
- Soroban settlement contract for immutable payment recording
- Separate pool contract for inter-contract withdraw flow

## Key Assumptions

- Users operate on Stellar testnet, not mainnet.
- Wallet extensions (Freighter, xBull, Lobstr) are available client-side.
- Supabase anon key is safe with proper RLS policies.
- Wallet authentication uses a server-generated Stellar challenge, client signature verification, and JWT claims; data access is not based on a client-provided wallet header.
- Contract IDs in env/docs are synchronized with deployed testnet contracts.

## Known Limitations

- Project is testnet-oriented; mainnet operational controls are not included.
- Mobile viewport screenshot proof is now included in `README.md` and `public/mobile-responsive.png`.
- CI merge protection enforcement is a GitHub repository setting and must be enabled manually in repo settings.
- Wallet UX depends on extension behavior and user approval flow.
- Some screenshots in README are desktop captures; mobile screenshots should be added for evaluator clarity.
- Pool balances are internal contract accounting credits, not native XLM/token custody transfers on-chain.
- **Trust Boundary & Settlement Proofs:** `record_payment` stores the provided `tx_hash` metadata only after the frontend client verifies the Horizon transaction details against the intended payment claim: source, destination, native asset, amount, memo, and successful ledger inclusion. This is still an off-chain client-side check, so a malicious actor bypassing the UI could call the contract directly with a fabricated `tx_hash` if the app or backend enforcement is circumvented. In production, this proof step should move to a secure backend oracle or an on-chain protocol upgrade.

## Operational Constraints

- Any contract redeployment changes contract ID and requires env + README updates.
- Incorrect wallet/account setup can block end-to-end payment tests.
- Supabase configuration errors can affect sync behavior even if chain operations work.

## Recommended Future Improvements

- Add automated e2e tests (Playwright) with mobile viewport assertions.
- Add a script to validate README proof links are live.
- Add an automated checklist CI job that verifies required docs/sections exist.
- Introduce token/native-asset backed pool settlement model (transfer in/out) for stronger economic guarantees.
- Add off-chain verifier service (or on-chain protocol changes) to bind `tx_hash` to payer/member/amount claims.
