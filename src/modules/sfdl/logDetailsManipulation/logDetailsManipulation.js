const fileLinesAnalyseFunctions = {
    removeHeapAllocateAndStatementExecute(line){
        return line && (line.includes('HEAP_ALLOCATE') || line.includes('STATEMENT_EXECUTE')); 
    },

    removeFlowNoise(line){
        return line && (line.includes('FLOW_CREATE_INTERVIEW_BEGIN') 
            || line.includes('FLOW_CREATE_INTERVIEW_END')
            || line.includes('FLOW_START_INTERVIEW_LIMIT_USAGE')
            || line.includes('FLOW_ELEMENT_LIMIT_USAGE')
            || line.includes('FLOW_INTERVIEW_FINISHED')
            || line.includes('FLOW_INTERVIEW_FINISHED_LIMIT_USAGE')); 
    },

    extractSoqlLine(line){
        return line && !line.includes('SOQL_EXECUTE');
    },

    isMethodEntryLine(line){
        return line && (line.includes('|METHOD_ENTRY|') 
            || line.includes('|SYSTEM_METHOD_ENTRY|') 
            || line.includes('|CONSTRUCTOR_ENTRY|')
            || line.includes('|FLOW_START_INTERVIEW_BEGIN|')
            || line.includes('|FLOW_ELEMENT_BEGIN|'));
    },

    isMethodEntryExit(line){
        return line && (line.includes('|METHOD_EXIT|') 
            || line.includes('|SYSTEM_METHOD_EXIT|') 
            || line.includes('|CONSTRUCTOR_EXIT|')
            || line.includes('|FLOW_START_INTERVIEW_END|')
            || line.includes('|FLOW_ELEMENT_END|'));
    },

    isCodeUnitStarted(line){
        return line && line.includes('|CODE_UNIT_STARTED|');
    },

    isCodeUnitFinished(line){
        return line && line.includes('|CODE_UNIT_FINISHED|');
    }
}

const invokeLinesFormatting = {
    methodEntryExitCodeUnitStartedFinished2Hierarchy(fileLinesArray){
        let tabs2Add = 0;
        return fileLinesArray.map(line => {
            if(fileLinesAnalyseFunctions.isMethodEntryLine(line) || fileLinesAnalyseFunctions.isCodeUnitStarted(line)){
                tabs2Add++;
                return tabs2Add2Line(tabs2Add - 1) + line;
            }
            if(fileLinesAnalyseFunctions.isMethodEntryExit(line) || fileLinesAnalyseFunctions.isCodeUnitFinished(line)){
                if(tabs2Add  === 0){
                    return tabs2Add;
                }
                tabs2Add--;
            }
            return tabs2Add2Line(tabs2Add) + line;
        })
    },

    defaultFormatting(fileLinesArray, function2Execute){
        return fileLinesArray.filter(
            line => !fileLinesAnalyseFunctions[function2Execute](line)
        );
    }
}

function tabs2Add2Line(numberOfTabs){
    let tab = '\t';
    return tab.repeat(numberOfTabs);
}

function invokeFilterFormatFunctions(logDetailsArrayOfLines, function2Execute){
    return invokeLinesFormatting[function2Execute] ? invokeLinesFormatting[function2Execute](logDetailsArrayOfLines) : invokeLinesFormatting.defaultFormatting(logDetailsArrayOfLines, function2Execute);
}

export function manipulationDetailLogs(logDetails, manipulationOptions){
    if(!logDetails){
        return '';
    }

    let logDetailsArrayOfLines = logDetails.split('\n');
    let logDetailsFormatted;
    let manipulationOptionsChecked = manipulationOptions?.reduce((itContainsCheckedOptions, value) => {
        return value.checked || itContainsCheckedOptions;
    }, false);

    if(manipulationOptions && manipulationOptionsChecked){
        manipulationOptions.forEach((option) => {
            if(option.checked){
                logDetailsFormatted = invokeFilterFormatFunctions(logDetailsFormatted ? logDetailsFormatted : logDetailsArrayOfLines, option.name);
                logDetailsFormatted.join('\n');
            }
        })
    }
    
    return logDetailsFormatted ? logDetailsFormatted.join('\n') : logDetails;
}