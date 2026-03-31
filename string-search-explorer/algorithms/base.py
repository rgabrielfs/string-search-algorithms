from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Any


@dataclass
class SearchStep:
    step_number: int
    text_index: int
    pattern_index: int
    comparison: str
    result: str
    comparisons_so_far: int
    highlight_text: List[int] = field(default_factory=list)
    highlight_pattern: List[int] = field(default_factory=list)
    aux_data: Dict[str, Any] = field(default_factory=dict)
    note: str = ""


@dataclass
class SearchResult:
    algorithm: str
    pattern: str
    text_length: int
    pattern_length: int
    occurrences: List[int]
    total_comparisons: int
    execution_time_ms: float
    steps: List[SearchStep]
    aux_structures: Dict[str, Any] = field(default_factory=dict)
    complexity_best: str = ""
    complexity_average: str = ""
    complexity_worst: str = ""


class SearchStrategy(ABC):
    def __init__(self):
        self.steps: List[SearchStep] = []
        self.comparisons: int = 0
        self._step_counter: int = 0

    def _add_step(
        self,
        text_index: int,
        pattern_index: int,
        comparison: str,
        result: str,
        highlight_text: List[int] = None,
        highlight_pattern: List[int] = None,
        aux_data: Dict[str, Any] = None,
        note: str = "",
    ):
        self._step_counter += 1
        self.steps.append(
            SearchStep(
                step_number=self._step_counter,
                text_index=text_index,
                pattern_index=pattern_index,
                comparison=comparison,
                result=result,
                comparisons_so_far=self.comparisons,
                highlight_text=highlight_text or [],
                highlight_pattern=highlight_pattern or [],
                aux_data=aux_data or {},
                note=note,
            )
        )

    def reset(self):
        self.steps = []
        self.comparisons = 0
        self._step_counter = 0

    @abstractmethod
    def search(self, text: str, pattern: str) -> SearchResult:
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @property
    @abstractmethod
    def complexity_best(self) -> str:
        pass

    @property
    @abstractmethod
    def complexity_average(self) -> str:
        pass

    @property
    @abstractmethod
    def complexity_worst(self) -> str:
        pass
