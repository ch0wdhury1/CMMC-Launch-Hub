import { useState, useCallback } from 'react';
import { ReadinessAnswers, ReadinessReport } from '../types';
import { READINESS_ANALYZER_KEY } from '../constants';
import { READINESS_QUESTIONS } from '../data/readinessQuestions';

const getAllQuestionIds = () => {
    return READINESS_QUESTIONS.flatMap(section => section.questions.map(q => q.id));
};

const initialAnswers = getAllQuestionIds().reduce((acc, id) => {
    acc[id] = '';
    return acc;
}, {} as ReadinessAnswers);

const loadAnswers = (): ReadinessAnswers => {
    try {
        const saved = localStorage.getItem(READINESS_ANALYZER_KEY);
        return saved ? JSON.parse(saved) : initialAnswers;
    } catch {
        return initialAnswers;
    }
};

const saveAnswers = (answers: ReadinessAnswers) => {
    localStorage.setItem(READINESS_ANALYZER_KEY, JSON.stringify(answers));
};

export const useReadinessData = () => {
    const [answers, setAnswers] = useState<ReadinessAnswers>(loadAnswers);
    const [report, setReport] = useState<ReadinessReport | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const updateAnswer = useCallback((id: string, value: any) => {
        setAnswers(prev => {
            const newAnswers = { ...prev, [id]: value };
            saveAnswers(newAnswers);
            return newAnswers;
        });
    }, []);

    const clearAnswers = useCallback(() => {
        setAnswers(initialAnswers);
        saveAnswers(initialAnswers);
    }, []);

    return {
        answers,
        updateAnswer,
        report,
        setReport,
        isLoading,
        setIsLoading,
        clearAnswers,
    };
};
