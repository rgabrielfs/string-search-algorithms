import time
from typing import List
from .base import SearchStrategy, SearchResult


class NaiveSearch(SearchStrategy):

    @property
    def name(self) -> str:
        return "Naive (Brute Force)"

    @property
    def complexity_best(self) -> str:
        return "O(n)"

    @property
    def complexity_average(self) -> str:
        return "O(n * m)"

    @property
    def complexity_worst(self) -> str:
        return "O(n * m)"

    def search(self, text: str, pattern: str) -> SearchResult:
        self.reset()
        n = len(text)
        m = len(pattern)
        occurrences: List[int] = []

        start_time = time.perf_counter()

        for i in range(n - m + 1):
            j = 0
            while j < m:
                self.comparisons += 1
                char_text = text[i + j]
                char_pat = pattern[j]
                matched = char_text == char_pat

                self._add_step(
                    text_index=i + j,
                    pattern_index=j,
                    comparison=f"text[{i+j}]='{char_text}' vs pattern[{j}]='{char_pat}'",
                    result="match" if matched else "mismatch",
                    highlight_text=list(range(i, i + j + 1)),
                    highlight_pattern=list(range(0, j + 1)),
                    aux_data={"window_start": i, "window_end": i + m - 1},
                    note=f"Window at i={i}, comparing position j={j}",
                )

                if not matched:
                    break
                j += 1

            if j == m:
                occurrences.append(i)
                self._add_step(
                    text_index=i,
                    pattern_index=0,
                    comparison=f"Pattern found at index {i}",
                    result="found",
                    highlight_text=list(range(i, i + m)),
                    highlight_pattern=list(range(m)),
                    note=f"Complete match found at position {i}",
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
            complexity_best=self.complexity_best,
            complexity_average=self.complexity_average,
            complexity_worst=self.complexity_worst,
        )
