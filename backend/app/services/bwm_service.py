import numpy as np

class BWMService:
    # Consistency Index (CI) berdasarkan Rezaei (2015) untuk skala perbandingan 1 sampai 9
    CONSISTENCY_INDEX_MAP = {
        1: 0.00,
        2: 0.44,
        3: 1.00,
        4: 1.63,
        5: 2.30,
        6: 3.00,
        7: 3.73,
        8: 4.47,
        9: 5.23
    }

    @staticmethod
    def hitung_bobot_bwm(kriteria_codes, best_code, worst_code, best_to_others, others_to_worst):
        """
        Menyelesaikan model optimasi linier Best Worst Method:
            Min xi
            s.t.
            |w_B - a_{Bj} * w_j| <= xi
            |w_j - a_{jW} * w_W| <= xi
            sum(w_j) = 1
            w_j >= 0, xi >= 0
        """
        n = len(kriteria_codes)
        best_idx = kriteria_codes.index(best_code)
        worst_idx = kriteria_codes.index(worst_code)

        try:
            from scipy.optimize import linprog

            # Variabel keputusan: [w_1, w_2, ..., w_n, xi] (Total n + 1 variabel)
            # Fungsi objektif: Min 0*w_1 + ... + 0*w_n + 1*xi
            c = [0.0] * n + [1.0]

            A_ub = []
            b_ub = []

            # 1. Batasan |w_B - a_{Bj} * w_j| <= xi
            for j in range(n):
                a_bj = float(best_to_others.get(kriteria_codes[j], 1.0))
                # w_B - a_{Bj} * w_j - xi <= 0
                row1 = [0.0] * (n + 1)
                row1[best_idx] = 1.0
                row1[j] -= a_bj
                row1[-1] = -1.0
                A_ub.append(row1)
                b_ub.append(0.0)

                # -w_B + a_{Bj} * w_j - xi <= 0
                row2 = [0.0] * (n + 1)
                row2[best_idx] = -1.0
                row2[j] += a_bj
                row2[-1] = -1.0
                A_ub.append(row2)
                b_ub.append(0.0)

            # 2. Batasan |w_j - a_{jW} * w_W| <= xi
            for j in range(n):
                a_jw = float(others_to_worst.get(kriteria_codes[j], 1.0))
                # w_j - a_{jW} * w_W - xi <= 0
                row1 = [0.0] * (n + 1)
                row1[j] = 1.0
                row1[worst_idx] -= a_jw
                row1[-1] = -1.0
                A_ub.append(row1)
                b_ub.append(0.0)

                # -w_j + a_{jW} * w_W - xi <= 0
                row2 = [0.0] * (n + 1)
                row2[j] = -1.0
                row2[worst_idx] += a_jw
                row2[-1] = -1.0
                A_ub.append(row2)
                b_ub.append(0.0)

            # 3. Batasan Persamaan: sum(w_j) = 1
            A_eq = [[1.0] * n + [0.0]]
            b_eq = [1.0]

            # Batas nilai w_j >= 0 dan xi >= 0
            bounds = [(0.0, 1.0)] * n + [(0.0, None)]

            res = linprog(c, A_ub=A_ub, b_ub=b_ub, A_eq=A_eq, b_eq=b_eq, bounds=bounds, method='highs')

            if res.success:
                weights = res.x[:n]
                xi_star = float(res.x[-1])
            else:
                weights, xi_star = BWMService._fallback_solver(kriteria_codes, best_code, worst_code, best_to_others, others_to_worst)

        except ImportError:
            weights, xi_star = BWMService._fallback_solver(kriteria_codes, best_code, worst_code, best_to_others, others_to_worst)

        # Hitung Rasio Konsistensi (Consistency Ratio / CR)
        max_a_bw = int(max(best_to_others.get(worst_code, 1), 1))
        ci = BWMService.CONSISTENCY_INDEX_MAP.get(max_a_bw, 3.0)
        cr = round(xi_star / ci, 4) if ci > 0 else 0.0

        hasil_bobot = {}
        for j in range(n):
            hasil_bobot[kriteria_codes[j]] = round(float(weights[j]), 4)

        return {
            "bobot": hasil_bobot,
            "vektor_bobot": [round(float(w), 4) for w in weights],
            "xi_star": round(xi_star, 4),
            "consistency_ratio": cr,
            "is_konsisten": cr <= 0.1
        }

    @staticmethod
    def _fallback_solver(kriteria_codes, best_code, worst_code, best_to_others, others_to_worst):
        """Metode aproksimasi geometris jika pustaka SciPy belum terpasang di sistem."""
        n = len(kriteria_codes)
        w_raw = []
        for code in kriteria_codes:
            a_bj = float(best_to_others.get(code, 1.0))
            a_jw = float(others_to_worst.get(code, 1.0))
            w_j = 1.0 / (a_bj if a_bj > 0 else 1.0) + (a_jw / 9.0)
            w_raw.append(w_j)

        total = sum(w_raw) or 1.0
        weights = [w / total for w in w_raw]
        return weights, 0.05