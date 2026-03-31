import time
from typing import List
from .base import SearchStrategy, SearchResult


class KMPSearch(SearchStrategy):

    @property
    def name(self) -> str:
        return "Knuth-Morris-Pratt (KMP)"

    @property
    def complexity_best(self) -> str:
        return "O(n)"

    @property
    def complexity_average(self) -> str:
        return "O(n + m)"

    @property
    def complexity_worst(self) -> str:
        return "O(n + m)"

    def _build_lps(self, pattern: str) -> List[int]:
        m = len(pattern)
        lps = [0] * m
        length = 0
        i = 1

        while i < m:
            if pattern[i] == pattern[length]:
                length += 1
                lps[i] = length
                i += 1
            else:
                if length != 0:
                    length = lps[length - 1]
                else:
                    lps[i] = 0
                    i += 1

        return lps

    def search(self, text: str, pattern: str) -> SearchResult:
        self.reset()
        n = len(text)
        m = len(pattern)
        occurrences: List[int] = []

        start_time = time.perf_counter()

        lps = self._build_lps(pattern)

        self._add_step(
            text_index=0,
            pattern_index=0,
            comparison="Building LPS (Longest Proper Prefix which is also Suffix) table",
            result="info",
            aux_data={"lps_table": lps, "pattern": pattern},
            note=f"LPS table computed: {lps}",
        )

        i = 0  # index for text
        j = 0  # index for pattern

        while i < n:
            self.comparisons += 1
            char_text = text[i]
            char_pat = pattern[j]
            matched = char_text == char_pat

            self._add_step(
                text_index=i,
                pattern_index=j,
                comparison=f"text[{i}]='{char_text}' vs pattern[{j}]='{char_pat}'",
                result="match" if matched else "mismatch",
                highlight_text=[i],
                highlight_pattern=[j],
                aux_data={"lps_table": lps, "i": i, "j": j},
                note=f"Comparing text[{i}] with pattern[{j}]",
            )

            if matched:
                i += 1
                j += 1

            if j == m:
                occurrences.append(i - j)
                self._add_step(
                    text_index=i - j,
                    pattern_index=0,
                    comparison=f"Pattern found at index {i - j}",
                    result="found",
                    highlight_text=list(range(i - j, i)),
                    highlight_pattern=list(range(m)),
                    aux_data={"lps_table": lps},
                    note=f"Match at position {i - j}, using LPS to skip to j={lps[j - 1]}",
                )
                j = lps[j - 1]
            elif i < n and not matched:
                if j != 0:
                    old_j = j
                    j = lps[j - 1]
                    self._add_step(
                        text_index=i,
                        pattern_index=j,
                        comparison=f"Mismatch: skip pattern using LPS[{old_j - 1}]={lps[old_j - 1]}",
                        result="skip",
                        highlight_text=[i],
                        highlight_pattern=[j],
                        aux_data={"lps_table": lps, "skipped_to": j},
                        note=f"Using LPS to avoid redundant comparisons, j: {old_j} -> {j}",
                    )
                else:
                    i += 1

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
            aux_structures={"lps_table": lps},
            complexity_best=self.complexity_best,
            complexity_average=self.complexity_average,
            complexity_worst=self.complexity_worst,
        )
