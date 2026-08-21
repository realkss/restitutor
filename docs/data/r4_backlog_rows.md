#### Backlog additions — natural units / GR / historical

| System | Generators set to 1 | Class | Tier | Adjudication |
|---|---|---|---|---|
| Kolb–Turner units (ħ = c = k_B = 1; G retained as m_Pl⁻², m_Pl unreduced) | `\hbar; c; k_B\ (G\ \text{kept as } m_{\rm Pl}^{-2},\ m_{\rm Pl}\ \text{unreduced})` | quotient | **v1** | backlog round 4, verified; residual rank 1 (mass) against rank 0 for Planck and reduced-Planck; discriminator is the 8π in H² = 8πρ/3m_Pl² |
| GADGET / AREPO / GIZMO cosmological code units (G = 43007.1 internal) | `[L] = h^{-1}\mathrm{kpc}; [M] = 10^{10}h^{-1}M_\odot; [V] = \mathrm{km\,s^{-1}}` | custom generators | **v2** | backlog round 4, verified; twin of the nondim code-unit-triple row; 43007.1 pins G_cgs = 6.672×10⁻⁸ (CODATA-2022 gives 43021.9) |
| Schrödinger units (ħ = G = e²/4πε₀ = 1 ⇒ c = 1/α = 137.036) | `\hbar; G; \dfrac{e^2}{4\pi\varepsilon_0}` | quotient | **v2** | backlog round 4, verified; rank 3, well-posed; c = 137.036 is *derived* — never read it as a generator (§6.4's 137-set becomes a quintet) |
| Physical atomic-mass scale (¹⁶O ≡ 16), pre-1961 | `(none)` | numeric-only | **v2** | backlog round 4, verified; 1 u = 1.00031794 amu_phys (+317.94 ppm); the §5 N_A fingerprint is weak — the tell is ¹⁶O = 16.000000 with ¹²C ≠ 12 |
| Chemical atomic-mass scale (natural oxygen ≡ 16), pre-1961 | `(none)` | numeric-only | **v2** | backlog round 4, verified; unified/chemical = 1.0000429; the one factor that is not a constant of nature — store it with an oxygen-composition tag |
| Pre-1990 as-maintained national electrical units (V_NBS, V₆₉, Ω_NBS) | `(none)` | quotient + riders | **v2** | backlog round 4, verified; twin of the 1990 conventional-units row; V₉₀/V_NBS = 1 + 9.264×10⁻⁶, the ohm +1.69×10⁻⁶ — record the direction |
| Legal ohm of 1884 (Paris International Conference of Electricians) | `(none)` | numeric-only | **v2** | backlog round 4, verified; −0.28222% against the international ohm and −0.23336% against the absolute — store both; never alias (§7) |
| Weber's electrodynamic charge and current units (q_ed = q_EMU/√2) | `(none)` | numeric-only | **v2** | backlog round 4, verified; a magnitudes-only converter carved from the unsupported Weber row; fingerprint c_W = √2c = 4.2397×10⁸ m/s (§6.6) |

#### Backlog additions — nondimensionalization presets

| System | Generators set to 1 | Class | Tier | Adjudication |
|---|---|---|---|---|
| Rotating-frame (GFD) scaling — Rossby, Ekman, Burger | `L; H; 1\ \text{or}\ 2·\Omega\ (\text{declared as } f\ \text{or as }\Omega); U; \rho_0` | custom generators | **v2** | backlog round 4, verified; Ro and Ek each carry an exact ×2 fork and Bu a square-root fork; all three are residues (§2.10) |
| Geodynamo scalings and the Elsasser magnetic-field normalizations | `D; 1\ \text{or}\ 2·\Omega; \rho_0; \eta; 1\ \text{or}\ 4\pi·\mu_0; \sqrt{\rho\mu_0\eta\Omega}\ \text{or}\ \sqrt{\rho\mu_0}U·B_0` | quotient + riders | **v2** | backlog round 4, verified; mirrors the MHD Alfvénic √(4π); Ra* = RaE²/Pr is 10⁻¹² at E = 10⁻⁶, so Ra = 10¹⁰ and Ra* = 10⁻² are one run |
| Kolmogorov (dissipation-range) units — η, u_η, τ_η | `\nu; \varepsilon; \rho` | custom generators | **v2** | backlog round 4, verified; rank 3, well-posed — ν = ε = ρ = 1 is exactly η = u_η = τ_η = 1, Re_η = 1 identically; k_maxη is a resolution criterion |
| Lattice-Boltzmann units (δx = δt = 1, c_s² = 1/3, ν = (τ−½)c_s²) | `\delta x; \delta t; \rho_0` | custom generators | **v2** | backlog round 4, verified; rank 3, well-posed; dropping the −½ is ×2–6 in ν and Re; "c = 1" here is the lattice speed, a §6.4 homograph |
| CR3BP canonical (synodic) units — G(m₁+m₂) = a = n = 1, residue μ | `G(m_1+m_2); a\ (\mathrm{DU}); n^{-1}\ (\mathrm{TU})` | custom generators | **v2** | backlog round 4, verified; merges with the astrodynamics canonical row (§8); μ is a residue (§2.10); Jacobi carries a ×2 and a ±½μ(1−μ) fork |
| Lane–Emden polytrope scaling (θ, ξ, α) | `\alpha = \big[(n+1)K\rho_c^{1/n-1}/4\pi G\big]^{1/2}; \rho_c; G` | custom generators | **v2** | backlog round 4, verified; [K] = M^(−1/n)L^((2n+3)/n)T⁻², so the generator's *dimension* depends on n — lift n before the solve |
| Gross–Pitaevskii healing-length units (ξ = ħ/√(2mgn) vs ħ/√(mgn)) | `\hbar; m; \tfrac12\ \text{or}\ 1·mgn` | quotient + riders | **v1** | backlog round 4, verified; a genuine √2 fork; the Laplacian coefficient (1 vs ½) discriminates and the dark-soliton width is ħ/√(mgn) always |
| Fourier–diffusion scaling (Fo, Bi, Pe, Sc) | `L_c\ (V/A_s,\ R,\ \text{or}\ D_h); \alpha\ \text{or}\ D; \Delta T; \rho c_p` | quotient + riders | **v2** | backlog round 4, verified; the θ offset is affine — tag-and-restrict (§2.13(f)); the L_c fork is ×3 in Bi and ×9 in Fo for a sphere |
| Combustion/flame units (δ_L, s_L, Ze, Da, Ka) | `\delta_L\ (\delta_L^0\ \text{or}\ \delta_D); s_L; \rho_u\ \text{or}\ \rho_b; \Delta T` | custom generators | **v2** | backlog round 4, verified; rank 4 with Θ; the generator *values* are definition-dependent — resolve δ_L from its printed expression (§2.13(e)) |
| Hybrid-code ion-scale units (d_i, Ω_ci⁻¹, v_A, B₀, n₀, m_i) | `m_i; e; B_0; n_0; 1\ \text{or}\ 4\pi·\mu_0` | quotient + riders | **v2** | backlog round 4, verified; d_i, Ω_ci⁻¹, v_A are not independent (d_iΩ_ci = v_A); the absence of c is a Darwin rank reduction, not c = 1 |
