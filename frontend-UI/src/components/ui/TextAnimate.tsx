"use client";

import { motion, Variants } from "framer-motion";
import { cn } from "@/lib/utils";
import React from "react";

interface TextAnimateProps {
  children: string;
  className?: string;
  animation?: "slideLeft" | "slideRight" | "slideUp" | "slideDown" | "fadeIn" | "blurInUp";
  by?: "character" | "word" | "line";
}

export function TextAnimate({
  children,
  className,
  animation = "slideLeft",
  by = "character",
}: TextAnimateProps) {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.04,
      },
    },
  };

  const getChildVariants = (): Variants => {
    switch (animation) {
      case "slideLeft":
        return {
          hidden: { opacity: 0, x: 20 },
          visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
        };
      case "slideRight":
        return {
          hidden: { opacity: 0, x: -20 },
          visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
        };
      case "slideUp":
        return {
          hidden: { opacity: 0, y: 20 },
          visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
        };
      case "slideDown":
        return {
          hidden: { opacity: 0, y: -20 },
          visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
        };
      case "blurInUp":
        return {
          hidden: { opacity: 0, filter: "blur(10px)", y: 20 },
          visible: { opacity: 1, filter: "blur(0px)", y: 0, transition: { duration: 0.4 } },
        };
      case "fadeIn":
      default:
        return {
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { duration: 0.3 } },
        };
    }
  };

  const childVariants = getChildVariants();

  const getItems = () => {
    if (by === "character") {
      return children.split("").map((char, i) => (
        <motion.span key={i} variants={childVariants} className="inline-block">
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ));
    }
    if (by === "word") {
      return children.split(" ").map((word, i) => (
        <motion.span key={i} variants={childVariants} className="inline-block mr-1">
          {word}
        </motion.span>
      ));
    }
    return (
      <motion.span variants={childVariants} className="inline-block">
        {children}
      </motion.span>
    );
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={containerVariants}
      className={cn("inline-block", className)}
    >
      {getItems()}
    </motion.div>
  );
}
