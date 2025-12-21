import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FAQItem } from '../../help/faq';
import { logger } from '../../services/logging';

interface FAQAccordionProps {
  items: FAQItem[];
}

/**
 * FAQAccordion Component
 *
 * Expandable accordion for FAQ items.
 * Only one item can be open at a time.
 * Includes smooth expand/collapse animation.
 */
export function FAQAccordion({ items }: FAQAccordionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleToggle = useCallback((id: string) => {
    setExpandedId((current) => {
      const newValue = current === id ? null : id;
      logger.logInfo('FAQ item toggled', {
        component: 'FAQAccordion',
        itemId: id,
        action: newValue === id ? 'expand' : 'collapse',
      });
      return newValue;
    });
  }, []);

  return (
    <div className="faq-accordion">
      {items.map((item) => (
        <FAQAccordionItem
          key={item.id}
          item={item}
          isExpanded={expandedId === item.id}
          onToggle={() => handleToggle(item.id)}
        />
      ))}
    </div>
  );
}

interface FAQAccordionItemProps {
  item: FAQItem;
  isExpanded: boolean;
  onToggle: () => void;
}

function FAQAccordionItem({ item, isExpanded, onToggle }: FAQAccordionItemProps) {
  return (
    <div className={`faq-item ${isExpanded ? 'expanded' : ''}`}>
      <button
        className="faq-item-header"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={`faq-content-${item.id}`}
      >
        <span className="faq-item-question">{item.question}</span>
        <motion.span
          className="material-icons faq-item-icon"
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          expand_more
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            id={`faq-content-${item.id}`}
            className="faq-item-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <div className="faq-item-answer">{item.answer}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FAQAccordion;
