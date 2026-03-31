import time
from typing import List
from .base import SearchStrategy, SearchResult

BASE = 256
MOD = 101


class RabinKarpSearch(SearchStrategy):

    @property
    def name(self) -> str:
        return "Rabin-Karp"

    @property
    def complexity_best(self) -> str:
        return "O(n + m)"

    @property
    def complexity_average(self) -> str:
        return "O(n + m)"

    @property
    def complexity_worst(self) -> str:
        return "O(n * m)"

    def search(self, text: str, pattern: str) -> SearchResult:
        self.reset()
        n = len(text)
        m = len(pattern)
        occurrences: List[int] = []

        if m > n:
            return SearchResult(
                algorithm=self.name,
                pattern=pattern,
                text_length=n,
                pattern_length=m,
                occurrences=[],
                total_comparisons=0,
                execution_time_ms=0.0,
                steps=[],
                complexity_best=self.complexity_best,
                complexity_average=self.complexity_average,
                complexity_worst=self.complexity_worst,
            )

        start_time = time.perf_counter()

        # h = BASE^(m-1) % MOD
        h = 1
        for _ in range(m - 1):
            h = (h * BASE) % MOD

        # Compute initial hashes
        pattern_hash = 0
        window_hash = 0
        for i in range(m):
            pattern_hash = (BASE * pattern_hash + ord(pattern[i])) % MOD
            window_hash = (BASE * window_hash + ord(text[i])) % MOD

        self._add_step(
            text_index=0,
            pattern_index=0,
            comparison=f"Initial hash: pattern_hash={pattern_hash}, window_hash={window_hash}",
            result="info",
            highlight_text=list(range(m)),
            highlight_pattern=list(range(m)),
            aux_data={
                "pattern_hash": pattern_hash,
                "window_hash": window_hash,
                "h": h,
                "base": BASE,
                "mod": MOD,
            },
            note="Computing initial rolling hashes",
        )

        for i in range(n - m + 1):
            hash_match = pattern_hash == window_hash

            self._add_step(
                text_index=i,
                pattern_index=0,
                comparison=f"window_hash={window_hash} vs pattern_hash={pattern_hash}",
                result="hash_match" if hash_match else "hash_mismatch",
                highlight_text=list(range(i, i + m)),
                highlight_pattern=list(range(m)),
                aux_data={
                    "pattern_hash": pattern_hash,
                    "window_hash": window_hash,
                    "window": text[i : i + m],
                },
                note=f"Comparing hashes at window i={i}",
            )

            if hash_match:
                # Verify character by character
                match = True
                for j in range(m):
                    self.comparisons += 1
                    char_text = text[i + j]
                    char_pat = pattern[j]
                    char_match = char_text == char_pat

                    self._add_step(
                        text_index=i + j,
                        pattern_index=j,
                        comparison=f"Verify: text[{i+j}]='{char_text}' vs pattern[{j}]='{char_pat}'",
                        result="match" if char_match else "mismatch",
                        highlight_text=list(range(i, i + j + 1)),
                        highlight_pattern=list(range(j + 1)),
                        note="Hash matched - verifying character by character",
                    )

                    if not char_match:
                        match = False
                        break

                if match:
                    occurrences.append(i)
                    self._add_step(
                        text_index=i,
                        pattern_index=0,
                        comparison=f"Pattern found at index {i}",
                        result="found",
                        highlight_text=list(range(i, i + m)),
                        highlight_pattern=list(range(m)),
                        note=f"Complete match confirmed at position {i}",
                    )

            # Roll hash
            if i < n - m:
                window_hash = (BASE * (window_hash - ord(text[i]) * h) + ord(text[i + m])) % MOD
                if window_hash < 0:
                    window_hash += MOD

                self._add_step(
                    text_index=i + 1,
                    pattern_index=0,
                    comparison=f"Rolling hash: remove '{text[i]}', add '{text[i+m]}'",
                    result="roll",
                    highlight_text=list(range(i + 1, i + m + 1)),
                    aux_data={"new_window_hash": window_hash, "window": text[i + 1 : i + m + 1]},
                    note=f"Rolling window forward: new hash={window_hash}",
                )

        elapsed = (time.perf_counter() - start_time) * 1000

        return SearchResult(
            algorithm=self.name,
            pattern=pattern,
            text_length=n,
            pattern_length=m,
            occurrences=occurrences,
            total_comparisons=self.comparisons,
            execution_time_ms=round(elapsed, 4),
            steps=self.steps,
            aux_structures={"base": BASE, "mod": MOD},
            complexity_best=self.complexity_best,
            complexity_average=self.complexity_average,
            complexity_worst=self.complexity_worst,
        )
